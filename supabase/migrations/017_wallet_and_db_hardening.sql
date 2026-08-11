-- Wallet withdrawals + lock down PostgREST leaks + OTP rate-limit table.

create table if not exists public.wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  amount_paise integer not null check (amount_paise >= 10000),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  account_holder text not null,
  account_number_last4 text not null,
  ifsc text not null,
  upi_id text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_wallet_withdrawals_creator
  on public.wallet_withdrawals (creator_id, created_at desc);

alter table public.wallet_withdrawals enable row level security;
revoke all on table public.wallet_withdrawals from anon, authenticated;

create table if not exists public.auth_rate_limits (
  key text primary key,
  hit_count integer not null default 0 check (hit_count >= 0),
  window_start timestamptz not null default now()
);

alter table public.auth_rate_limits enable row level security;
revoke all on table public.auth_rate_limits from anon, authenticated;

create index if not exists idx_post_purchases_creator_paid
  on public.post_purchases (creator_id, paid_at desc)
  where status = 'paid';

-- Stop anonymous/authenticated PostgREST from reading media_paths / social graphs.
-- All product reads go through the auth edge function (service role).
drop policy if exists "Public profiles can read free posts" on public.posts;
drop policy if exists "Anyone can read post likes" on public.post_likes;
drop policy if exists "Anyone can read post views" on public.post_views;
drop policy if exists "Public profiles can read follows" on public.follows;

revoke all on table public.posts from anon, authenticated;
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.post_views from anon, authenticated;
revoke all on table public.follows from anon, authenticated;
revoke all on table public.post_purchases from anon, authenticated;
revoke all on table public.payout_accounts from anon, authenticated;
revoke all on table public.support_tickets from anon, authenticated;
revoke all on table public.post_reports from anon, authenticated;
