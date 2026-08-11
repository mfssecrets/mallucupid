-- Separate consumer users from creators. The role is database-authoritative;
-- auth metadata is only a frontend convenience.
create table if not exists public.user_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('creator', 'user')),
  name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_user_accounts_email_lower
  on public.user_accounts (lower(email))
  where email is not null;

-- Every existing profile is an existing creator account.
insert into public.user_accounts (id, role, name)
select id, 'creator', coalesce(full_name, '')
from public.profiles
on conflict (id) do update set role = 'creator';

alter table public.user_accounts enable row level security;
-- No direct policies: account-role data is accessed through the edge function.

-- Consumer accounts do not have creator profiles, so followers must reference
-- auth.users rather than profiles. The followed account remains a creator.
alter table public.follows
  drop constraint if exists follows_follower_id_fkey;
alter table public.follows
  add constraint follows_follower_id_fkey
  foreign key (follower_id) references auth.users(id) on delete cascade;
