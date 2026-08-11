-- 028_live_streams.sql
-- End-to-end live streaming system: schedule, booking, paid entry, gifts, earnings.

-- ─── Stream status enum (text-checked) ────────────────────────────────────
-- scheduled | live | ended | cancelled

-- ─── live_streams ─────────────────────────────────────────────────────────
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  scheduled_start timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (15, 30, 45, 60)),
  is_paid boolean not null default false,
  entry_fee_paise integer not null default 0 check (entry_fee_paise >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  join_token text not null,
  started_at timestamptz,
  ended_at timestamptz,
  active_viewers integer not null default 0,
  peak_viewers integer not null default 0,
  total_earnings_paise integer not null default 0,
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_streams_creator on public.live_streams (creator_id, scheduled_start desc);
create index if not exists idx_live_streams_status on public.live_streams (status, scheduled_start);
create index if not exists idx_live_streams_public_id on public.live_streams (public_id);

alter table public.live_streams enable row level security;
revoke all on table public.live_streams from anon, authenticated;

-- ─── live_stream_bookings ─────────────────────────────────────────────────
-- One row per (stream, viewer). For paid streams this holds the payment audit.
create table if not exists public.live_stream_bookings (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_paid boolean not null default false,
  amount_paise integer not null default 0,
  platform_fee_percent numeric(5,2) not null default 3.00,
  platform_fee_paise integer not null default 0,
  net_to_creator_paise integer not null default 0,
  final_amount_paise integer not null default 0,
  currency text not null default 'INR',
  provider text not null default 'razorpay',
  razorpay_order_id text not null default '',
  razorpay_payment_id text not null default '',
  status text not null default 'created' check (status in ('created','paid','cancelled')),
  paid_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (stream_id, user_id)
);

create index if not exists idx_lsb_stream on public.live_stream_bookings (stream_id, status);
create index if not exists idx_lsb_user on public.live_stream_bookings (user_id);
create index if not exists idx_lsb_order on public.live_stream_bookings (razorpay_order_id);

alter table public.live_stream_bookings enable row level security;
revoke all on table public.live_stream_bookings from anon, authenticated;

-- ─── live_stream_gifts (catalog) ──────────────────────────────────────────
create table if not exists public.live_stream_gift_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  emoji text not null default '🎁',
  amount_paise integer not null check (amount_paise > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.live_stream_gift_catalog enable row level security;
-- Catalog is readable by anyone (anon/authenticated) so the gift UI can render.
drop policy if exists "Anyone can read gift catalog" on public.live_stream_gift_catalog;
create policy "Anyone can read gift catalog"
  on public.live_stream_gift_catalog for select
  using (active = true);

-- Seed the gift catalog from the reference image.
insert into public.live_stream_gift_catalog (code, name, emoji, amount_paise, sort_order) values
  ('strawberry',    'Strawberry',        '🍓',  3900,  1),
  ('piano',         'Piano',             '🎹',  5000,  2),
  ('musical_note',  'Musical Note',      '🎵',  5900,  3),
  ('cherries',      'Cherries',          '🍒',  5900,  4),
  ('lips',          'Lips',              '👄',  7500,  5),
  ('drum_set',      'Drum Set',          '🥁',  7900,  6),
  ('guitar',        'Guitar',            '🎸',  7900,  7),
  ('rose',          'Rose',              '🌹',  8900,  8),
  ('microphone',    'Microphone',        '🎤',  9900,  9),
  ('electric_gtr',  'Electric Guitar',   '🤘',  9900, 10),
  ('rabbit',        'Rabbit',            '🐰', 14900, 11),
  ('heart_balloon', 'Heart Balloon',     '🎈', 19900, 12),
  ('champagne',     'Champagne Bottles', '🍾', 29900, 13),
  ('magic_lamp',    'Magic Lamp',        '🪔', 39900, 14),
  ('gold_ring',     'Gold Ring',         '💍', 49900, 15),
  ('crystal_ball',  'Crystal Ball',      '🔮', 57900, 16)
on conflict (code) do nothing;

-- ─── live_stream_gifts (transactions) ─────────────────────────────────────
create table if not exists public.live_stream_gifts (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  gift_code text not null,
  gift_name text not null,
  amount_paise integer not null check (amount_paise > 0),
  platform_fee_percent numeric(5,2) not null default 3.00,
  platform_fee_paise integer not null default 0,
  net_to_creator_paise integer not null default 0,
  currency text not null default 'INR',
  provider text not null default 'razorpay',
  razorpay_order_id text not null default '',
  razorpay_payment_id text not null default '',
  status text not null default 'created' check (status in ('created','paid','refunded')),
  paid_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lsg_stream on public.live_stream_gifts (stream_id, created_at desc);
create index if not exists idx_lsg_creator on public.live_stream_gifts (creator_id, status);
create index if not exists idx_lsg_sender on public.live_stream_gifts (sender_id);
create index if not exists idx_lsg_order on public.live_stream_gifts (razorpay_order_id);

alter table public.live_stream_gifts enable row level security;
revoke all on table public.live_stream_gifts from anon, authenticated;

-- ─── live_stream_viewers (presence / unique viewers) ──────────────────────
create table if not exists public.live_stream_viewers (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (stream_id, user_id)
);

create index if not exists idx_lsv_stream on public.live_stream_viewers (stream_id);

alter table public.live_stream_viewers enable row level security;
revoke all on table public.live_stream_viewers from anon, authenticated;

-- ─── live_stream_chat (comment log; off/on by creator) ────────────────────
create table if not exists public.live_stream_chat (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_lsc_stream on public.live_stream_chat (stream_id, created_at desc);

alter table public.live_stream_chat enable row level security;
revoke all on table public.live_stream_chat from anon, authenticated;
