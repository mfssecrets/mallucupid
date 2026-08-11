-- 24h withdrawal hold + admin transfer proof fields + slip storage.

alter table public.wallet_withdrawals
  drop constraint if exists wallet_withdrawals_status_check;

alter table public.wallet_withdrawals
  add constraint wallet_withdrawals_status_check
  check (status in ('pending', 'accepted', 'paid', 'rejected'));

alter table public.wallet_withdrawals
  add column if not exists transfer_txn_id text not null default '',
  add column if not exists transfer_amount_paise integer,
  add column if not exists transfer_slip_path text not null default '',
  add column if not exists accepted_at timestamptz;

-- Only sales paid at least 24h ago are withdrawable.
create or replace function public.wallet_withdrawable_paise(p_creator_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(amount_paise, round(amount * 100)::integer)), 0)::bigint
  from public.post_purchases
  where creator_id = p_creator_id
    and status = 'paid'
    and paid_at is not null
    and paid_at <= now() - interval '24 hours';
$$;

revoke all on function public.wallet_withdrawable_paise(uuid) from public, anon, authenticated;
grant execute on function public.wallet_withdrawable_paise(uuid) to service_role;

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

  insert into public.wallet_withdrawals (
    creator_id, amount_paise, status, account_holder, account_number_last4, ifsc, upi_id
  ) values (
    p_creator_id, p_amount_paise, 'pending', p_account_holder, p_account_number_last4, p_ifsc, coalesce(p_upi_id, '')
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.request_wallet_withdrawal(uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_wallet_withdrawal(uuid, integer, text, text, text, text) to service_role;

-- Private bucket for admin bank-transfer slips (service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-slips',
  'admin-slips',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
