-- Wallet payout accounts and help/support tokens.

create table if not exists public.payout_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_holder text not null default '',
  account_number text not null default '',
  ifsc text not null default '',
  upi_id text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;

drop policy if exists "Users read own payout account" on public.payout_accounts;
create policy "Users read own payout account"
  on public.payout_accounts for select
  using (auth.uid() = user_id);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_reply text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Users read own support tickets" on public.support_tickets;
create policy "Users read own support tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);
