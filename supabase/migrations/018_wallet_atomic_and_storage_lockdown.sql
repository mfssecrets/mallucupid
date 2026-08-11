-- Atomic wallet withdraw + lock down post-media direct access + revoke messaging grants.

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
  lifetime_paise bigint;
  reserved_paise bigint;
  available_paise bigint;
  inserted public.wallet_withdrawals;
begin
  if p_amount_paise is null or p_amount_paise < 10000 then
    raise exception 'minimum_withdrawal';
  end if;

  select coalesce(sum(coalesce(amount_paise, round(amount * 100)::integer)), 0)
    into lifetime_paise
  from public.post_purchases
  where creator_id = p_creator_id and status = 'paid';

  select coalesce(sum(amount_paise), 0)
    into reserved_paise
  from public.wallet_withdrawals
  where creator_id = p_creator_id and status in ('pending', 'paid');

  available_paise := lifetime_paise - reserved_paise;
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

create or replace function public.wallet_lifetime_paise(p_creator_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(amount_paise, round(amount * 100)::integer)), 0)::bigint
  from public.post_purchases
  where creator_id = p_creator_id and status = 'paid';
$$;

revoke all on function public.wallet_lifetime_paise(uuid) from public, anon, authenticated;
grant execute on function public.wallet_lifetime_paise(uuid) to service_role;

-- Remove authenticated direct access to private post media (edge signed URLs only).
drop policy if exists "Creators read own post media" on storage.objects;
drop policy if exists "Creators upload own post media" on storage.objects;
drop policy if exists "Creators delete own post media" on storage.objects;

-- Keep upload via signed upload URLs from edge (service role). Creators no longer
-- have JWT-based storage CRUD that bypasses paid-access checks.

-- Defense-in-depth: revoke direct PostgREST on remaining edge-only tables.
revoke all on table public.user_accounts from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.user_blocks from anon, authenticated;
revoke all on table public.user_reports from anon, authenticated;

-- Stale policies on posts are harmless while GRANTs are revoked; drop public-facing ones already done in 017.
drop policy if exists "Creators can view own posts" on public.posts;
drop policy if exists "Creators can insert own posts" on public.posts;
drop policy if exists "Creators can update own posts" on public.posts;
drop policy if exists "Creators can delete own posts" on public.posts;
