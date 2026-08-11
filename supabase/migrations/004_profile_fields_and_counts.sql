-- Extend creator profiles and add database-backed social/content counts.
alter table public.profiles
  add column if not exists location text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists facebook_url text not null default '',
  add column if not exists gender text not null default 'Prefer not to say',
  add column if not exists is_private boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('Prefer not to say', 'Male', 'Female', 'Transgender'));

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists idx_follows_following_id on public.follows(following_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '',
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  is_paid boolean not null default false,
  price numeric(10, 2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_creator_created
  on public.posts(creator_id, created_at desc);

alter table public.follows enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Public profiles can read follows" on public.follows;
create policy "Public profiles can read follows"
  on public.follows for select using (true);

drop policy if exists "Public profiles can read free posts" on public.posts;
create policy "Public profiles can read free posts"
  on public.posts for select using (not is_paid);
