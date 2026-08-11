-- Create profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade,
  username text unique not null,
  full_name text,
  bio text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

create index if not exists idx_profiles_username on public.profiles (username);
