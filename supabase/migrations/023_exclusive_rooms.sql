-- Exclusive Rooms: Instagram-highlights style monthly entry rooms (max 4 per creator).

create table if not exists public.exclusive_rooms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  thumbnail_path text not null default '',
  entry_fee_paise integer not null check (entry_fee_paise >= 1000),
  sort_order smallint not null default 0 check (sort_order between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exclusive_rooms_name_len check (char_length(btrim(name)) between 1 and 10)
);

create unique index if not exists idx_exclusive_rooms_creator_sort
  on public.exclusive_rooms (creator_id, sort_order);

create index if not exists idx_exclusive_rooms_creator
  on public.exclusive_rooms (creator_id, created_at desc);

alter table public.exclusive_rooms enable row level security;
revoke all on table public.exclusive_rooms from public, anon, authenticated;
grant all on table public.exclusive_rooms to service_role;

create or replace function public.enforce_exclusive_room_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_count integer;
begin
  select count(*) into room_count
  from public.exclusive_rooms
  where creator_id = new.creator_id
    and (tg_op = 'INSERT' or id <> new.id);

  if room_count >= 4 then
    raise exception 'exclusive_room_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exclusive_room_limit on public.exclusive_rooms;
create trigger trg_exclusive_room_limit
  before insert or update of creator_id on public.exclusive_rooms
  for each row execute function public.enforce_exclusive_room_limit();

create table if not exists public.exclusive_room_posts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.exclusive_rooms (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  public_id text not null,
  caption text not null default '',
  media_type text not null check (media_type in ('image', 'video')),
  media_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint exclusive_room_posts_public_id_fmt check (public_id ~ '^[A-Za-z0-9]{8,16}$')
);

create unique index if not exists idx_exclusive_room_posts_public_id
  on public.exclusive_room_posts (public_id);

create index if not exists idx_exclusive_room_posts_room
  on public.exclusive_room_posts (room_id, created_at desc);

alter table public.exclusive_room_posts enable row level security;
revoke all on table public.exclusive_room_posts from public, anon, authenticated;
grant all on table public.exclusive_room_posts to service_role;

-- Monthly access: paid grants 30 days. Renew by paying again after expiry.
create table if not exists public.exclusive_room_subscriptions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.exclusive_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  amount_paise integer not null check (amount_paise >= 1000),
  razorpay_order_id text not null,
  razorpay_payment_id text not null default '',
  status text not null default 'created' check (status in ('created', 'paid', 'expired')),
  paid_at timestamptz,
  expires_at timestamptz,
  verified_at timestamptz,
  provider text not null default 'razorpay',
  created_at timestamptz not null default now(),
  constraint exclusive_room_subscriptions_order_unique unique (razorpay_order_id)
);

create index if not exists idx_exclusive_subs_user_room
  on public.exclusive_room_subscriptions (user_id, room_id, status, expires_at desc);

create index if not exists idx_exclusive_subs_creator_paid
  on public.exclusive_room_subscriptions (creator_id, paid_at desc)
  where status = 'paid';

alter table public.exclusive_room_subscriptions enable row level security;
revoke all on table public.exclusive_room_subscriptions from public, anon, authenticated;
grant all on table public.exclusive_room_subscriptions to service_role;

create or replace function public.has_active_exclusive_access(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exclusive_rooms r
    where r.id = p_room_id
      and r.creator_id = p_user_id
  )
  or exists (
    select 1
    from public.exclusive_room_subscriptions s
    where s.room_id = p_room_id
      and s.user_id = p_user_id
      and s.status = 'paid'
      and s.expires_at is not null
      and s.expires_at > now()
  );
$$;

revoke all on function public.has_active_exclusive_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.has_active_exclusive_access(uuid, uuid) to service_role;

-- Wallet totals include exclusive room entry fees.
create or replace function public.wallet_lifetime_paise(p_creator_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(coalesce(amount_paise, round(amount * 100)::integer))
    from public.post_purchases
    where creator_id = p_creator_id and status = 'paid'
  ), 0)::bigint
  + coalesce((
    select sum(amount_paise)
    from public.exclusive_room_subscriptions
    where creator_id = p_creator_id and status = 'paid'
  ), 0)::bigint;
$$;

revoke all on function public.wallet_lifetime_paise(uuid) from public, anon, authenticated;
grant execute on function public.wallet_lifetime_paise(uuid) to service_role;

create or replace function public.wallet_withdrawable_paise(p_creator_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(coalesce(amount_paise, round(amount * 100)::integer))
    from public.post_purchases
    where creator_id = p_creator_id
      and status = 'paid'
      and paid_at is not null
      and paid_at <= now() - interval '24 hours'
  ), 0)::bigint
  + coalesce((
    select sum(amount_paise)
    from public.exclusive_room_subscriptions
    where creator_id = p_creator_id
      and status = 'paid'
      and paid_at is not null
      and paid_at <= now() - interval '24 hours'
  ), 0)::bigint;
$$;

revoke all on function public.wallet_withdrawable_paise(uuid) from public, anon, authenticated;
grant execute on function public.wallet_withdrawable_paise(uuid) to service_role;
