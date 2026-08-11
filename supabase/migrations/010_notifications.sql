-- Notifications: likes, paid-post unlocks, message requests and accepts.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,   -- recipient
  actor_id uuid not null references auth.users on delete cascade,  -- who triggered it
  type text not null check (type in ('like', 'purchase', 'request', 'accept')),
  post_id uuid references public.posts on delete cascade,
  post_public_id text,
  conversation_id uuid references public.conversations on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);

-- A user gets at most one "like" notification per actor per post
create unique index if not exists uq_notifications_like
  on public.notifications (user_id, actor_id, post_id)
  where type = 'like';

-- RLS with no public policies: all access goes through the edge function (service role)
alter table public.notifications enable row level security;
