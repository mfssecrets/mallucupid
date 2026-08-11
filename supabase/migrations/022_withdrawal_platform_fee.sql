-- Platform fee on withdrawals: rate lives in platform_config; calculation via SQL functions only.

create table if not exists public.platform_config (
  key text primary key,
  value_int integer not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_config enable row level security;
revoke all on table public.platform_config from public, anon, authenticated;
grant select, insert, update on table public.platform_config to service_role;

insert into public.platform_config (key, value_int)
values ('withdrawal_fee_bps', 900) -- 9.00%
on conflict (key) do nothing;

-- Current withdrawal fee in basis points (100 bps = 1%).
create or replace function public.platform_withdrawal_fee_bps()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value_int from public.platform_config where key = 'withdrawal_fee_bps' limit 1),
    900
  )::integer;
$$;

revoke all on function public.platform_withdrawal_fee_bps() from public, anon, authenticated;
grant execute on function public.platform_withdrawal_fee_bps() to service_role;

-- Fee amount in paise for a gross withdrawal amount.
create or replace function public.calc_withdrawal_platform_fee_paise(p_amount_paise integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_amount_paise is null or p_amount_paise <= 0 then 0
    else greatest(
      0,
      round(
        (p_amount_paise::numeric * public.platform_withdrawal_fee_bps()::numeric) / 10000.0
      )::integer
    )
  end;
$$;

revoke all on function public.calc_withdrawal_platform_fee_paise(integer) from public, anon, authenticated;
grant execute on function public.calc_withdrawal_platform_fee_paise(integer) to service_role;

-- Net payout after platform fee.
create or replace function public.calc_withdrawal_net_payout_paise(p_amount_paise integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(p_amount_paise, 0) - public.calc_withdrawal_platform_fee_paise(p_amount_paise)
  );
$$;

revoke all on function public.calc_withdrawal_net_payout_paise(integer) from public, anon, authenticated;
grant execute on function public.calc_withdrawal_net_payout_paise(integer) to service_role;

alter table public.wallet_withdrawals
  add column if not exists platform_fee_paise integer not null default 0,
  add column if not exists net_payout_paise integer,
  add column if not exists fee_bps integer not null default 0;

-- Backfill existing rows with current fee schedule.
update public.wallet_withdrawals
set
  fee_bps = public.platform_withdrawal_fee_bps(),
  platform_fee_paise = public.calc_withdrawal_platform_fee_paise(amount_paise),
  net_payout_paise = public.calc_withdrawal_net_payout_paise(amount_paise)
where net_payout_paise is null
   or platform_fee_paise = 0
   or fee_bps = 0;

alter table public.wallet_withdrawals
  alter column net_payout_paise set not null;

alter table public.wallet_withdrawals
  drop constraint if exists wallet_withdrawals_fee_check;

alter table public.wallet_withdrawals
  add constraint wallet_withdrawals_fee_check
  check (
    platform_fee_paise >= 0
    and net_payout_paise >= 0
    and platform_fee_paise + net_payout_paise = amount_paise
  );

create or replace function public.request_wallet_withdrawal(
  p_creator_id uuid,
  p_amount_paise integer,
  p_account_holder text,
  p_account_number_last4 text,
  p_ifsc text,
  p_upi_id text default ''
)
returns public.wallet_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  withdrawable_paise bigint;
  reserved_paise bigint;
  available_paise bigint;
  fee_bps integer;
  fee_paise integer;
  net_paise integer;
  inserted public.wallet_withdrawals;
begin
  if p_amount_paise is null or p_amount_paise < 10000 then
    raise exception 'minimum_withdrawal';
  end if;

  select public.wallet_withdrawable_paise(p_creator_id) into withdrawable_paise;

  select coalesce(sum(amount_paise), 0)
    into reserved_paise
  from public.wallet_withdrawals
  where creator_id = p_creator_id and status in ('pending', 'accepted', 'paid');

  available_paise := withdrawable_paise - reserved_paise;
  if p_amount_paise > available_paise then
    raise exception 'insufficient_balance';
  end if;

  fee_bps := public.platform_withdrawal_fee_bps();
  fee_paise := public.calc_withdrawal_platform_fee_paise(p_amount_paise);
  net_paise := public.calc_withdrawal_net_payout_paise(p_amount_paise);

  if fee_paise + net_paise <> p_amount_paise then
    raise exception 'fee_calc_mismatch';
  end if;

  insert into public.wallet_withdrawals (
    creator_id,
    amount_paise,
    platform_fee_paise,
    net_payout_paise,
    fee_bps,
    status,
    account_holder,
    account_number_last4,
    ifsc,
    upi_id
  ) values (
    p_creator_id,
    p_amount_paise,
    fee_paise,
    net_paise,
    fee_bps,
    'pending',
    p_account_holder,
    p_account_number_last4,
    p_ifsc,
    coalesce(p_upi_id, '')
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.request_wallet_withdrawal(uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_wallet_withdrawal(uuid, integer, text, text, text, text) to service_role;
