-- Creator identity verification badge (Instagram-style).
-- Submit grants verified badge; admin can suspend/restore. Posting & exclusive rooms require active badge.

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.profiles
  add column if not exists verification_public_id text;

alter table public.profiles
  add column if not exists verification_status text not null default 'unverified';

alter table public.profiles
  drop constraint if exists profiles_verification_status_check;

alter table public.profiles
  add constraint profiles_verification_status_check
  check (verification_status in ('unverified', 'verified', 'suspended'));

create table if not exists public.creator_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  public_id text not null,
  legal_full_name text not null,
  date_of_birth date not null,
  id_front_path text not null,
  id_back_path text not null,
  terms_accepted_at timestamptz not null,
  status text not null default 'verified',
  admin_note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_verifications_public_id_fmt check (public_id ~ '^[A-Za-z0-9]{12}$'),
  constraint creator_verifications_name_len check (char_length(btrim(legal_full_name)) between 2 and 120),
  constraint creator_verifications_status_check check (status in ('verified', 'suspended'))
);

create unique index if not exists idx_creator_verifications_user
  on public.creator_verifications (user_id);

create unique index if not exists idx_creator_verifications_public_id
  on public.creator_verifications (public_id);

create index if not exists idx_creator_verifications_status_submitted
  on public.creator_verifications (status, submitted_at desc);

alter table public.creator_verifications enable row level security;
revoke all on table public.creator_verifications from public, anon, authenticated;
grant all on table public.creator_verifications to service_role;

-- Private ID document bucket (service-role / signed URL only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public/authenticated storage policies — edge function uses service role.

-- Age helper: true when DOB is at least 18 years ago.
create or replace function public.is_at_least_18(p_dob date)
returns boolean
language sql
immutable
as $$
  select p_dob is not null
    and p_dob <= (current_date - interval '18 years');
$$;

revoke all on function public.is_at_least_18(date) from public, anon, authenticated;
grant execute on function public.is_at_least_18(date) to service_role;

-- Active verified badge check for posting / exclusive rooms.
create or replace function public.creator_has_verified_badge(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_verified = true
      and p.verification_status = 'verified'
  );
$$;

revoke all on function public.creator_has_verified_badge(uuid) from public, anon, authenticated;
grant execute on function public.creator_has_verified_badge(uuid) to service_role;
