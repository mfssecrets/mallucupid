-- Exclusive rooms audit fixes: pending checkout uniqueness + cancelled status.

alter table public.exclusive_room_subscriptions
  drop constraint if exists exclusive_room_subscriptions_status_check;

alter table public.exclusive_room_subscriptions
  add constraint exclusive_room_subscriptions_status_check
  check (status in ('created', 'paid', 'expired', 'cancelled'));

-- Only one open checkout per user/room (prevents double-pay races).
create unique index if not exists idx_exclusive_subs_one_pending
  on public.exclusive_room_subscriptions (room_id, user_id)
  where status = 'created';

-- Mark paid rows expired when past expires_at (optional housekeeping helper).
create or replace function public.expire_exclusive_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.exclusive_room_subscriptions
  set status = 'expired'
  where status = 'paid'
    and expires_at is not null
    and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_exclusive_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_exclusive_subscriptions() to service_role;
