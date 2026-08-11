-- Direct messaging: conversations (with request/accept flow), messages
-- (text/media/view-once, per-user deletes, seen status), blocks and user reports.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  cleared_a timestamptz,
  cleared_b timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index if not exists idx_conversations_user_a on public.conversations (user_a, last_message_at desc);
create index if not exists idx_conversations_user_b on public.conversations (user_b, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  media_path text not null default '',
  media_type text not null default '' check (media_type in ('', 'image', 'video')),
  is_once boolean not null default false,
  viewed_at timestamptz,
  seen_at timestamptz,
  deleted_for uuid[] not null default '{}',
  deleted_for_all boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reporter_username text not null default '',
  reported_id uuid not null,
  reported_username text not null default '',
  conversation_id uuid,
  reason text not null,
  details text not null default '' check (char_length(details) <= 750),
  created_at timestamptz not null default now()
);

-- All access goes through the edge function with the service role;
-- RLS is enabled with no public policies so anon/authenticated direct access is denied.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

-- Private bucket for chat media, served only via signed URLs from the edge function
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 104857600, array['image/*', 'video/*'])
on conflict (id) do nothing;
