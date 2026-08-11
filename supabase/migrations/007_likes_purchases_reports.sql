-- Post likes, one-time post purchases (unlock system), and post reports.

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "Anyone can read post likes" on public.post_likes;
create policy "Anyone can read post likes"
  on public.post_likes for select
  using (true);

-- One-time, unlimited-duration unlock per user per post
create table if not exists public.post_purchases (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  razorpay_order_id text not null default '',
  razorpay_payment_id text not null default '',
  status text not null default 'created' check (status in ('created', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (post_id, user_id)
);

create index if not exists idx_post_purchases_user on public.post_purchases (user_id);

alter table public.post_purchases enable row level security;

drop policy if exists "Users read own purchases" on public.post_purchases;
create policy "Users read own purchases"
  on public.post_purchases for select
  using (auth.uid() = user_id);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  post_public_id text not null,
  owner_id uuid not null,
  owner_username text not null default '',
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reporter_username text not null default '',
  reason text not null,
  details text not null default '' check (char_length(details) <= 750),
  created_at timestamptz not null default now()
);

create index if not exists idx_post_reports_post on public.post_reports (post_id);

alter table public.post_reports enable row level security;

drop policy if exists "Users read own reports" on public.post_reports;
create policy "Users read own reports"
  on public.post_reports for select
  using (auth.uid() = reporter_id);
