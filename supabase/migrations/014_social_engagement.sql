-- Durable social engagement counters and race-safe toggle functions.

alter table public.posts
  add column if not exists like_count bigint not null default 0 check (like_count >= 0),
  add column if not exists view_count bigint not null default 0 check (view_count >= 0);

create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

create index if not exists idx_post_views_viewer
  on public.post_views(viewer_id, created_at desc);

alter table public.post_views enable row level security;

-- Counts are public metadata; writes remain edge-function-only.
drop policy if exists "Anyone can read post views" on public.post_views;
create policy "Anyone can read post views"
  on public.post_views for select
  using (true);

update public.posts p
set like_count = (
  select count(*) from public.post_likes l where l.post_id = p.id
);

update public.posts p
set view_count = (
  select count(*) from public.post_views v where v.post_id = p.id
);

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_sync_count on public.post_likes;
create trigger post_likes_sync_count
after insert or delete on public.post_likes
for each row execute function public.sync_post_like_count();

create or replace function public.sync_post_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set view_count = view_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set view_count = greatest(0, view_count - 1) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_views_sync_count on public.post_views;
create trigger post_views_sync_count
after insert or delete on public.post_views
for each row execute function public.sync_post_view_count();

create or replace function public.record_post_view(p_post_id uuid, p_viewer_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  insert into public.post_views(post_id, viewer_id)
  values (p_post_id, p_viewer_id)
  on conflict do nothing;

  select view_count into result from public.posts where id = p_post_id;
  return coalesce(result, 0);
end;
$$;

create or replace function public.toggle_post_like(p_post_id uuid, p_user_id uuid)
returns table(liked boolean, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.post_likes(post_id, user_id)
  values (p_post_id, p_user_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    delete from public.post_likes
    where post_id = p_post_id and user_id = p_user_id;
    liked := false;
  else
    liked := true;
  end if;

  select like_count into total from public.posts where id = p_post_id;
  return next;
end;
$$;

create or replace function public.toggle_creator_follow(p_follower_id uuid, p_creator_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if p_follower_id = p_creator_id then
    raise exception 'Cannot follow yourself';
  end if;

  insert into public.follows(follower_id, following_id)
  values (p_follower_id, p_creator_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    delete from public.follows
    where follower_id = p_follower_id and following_id = p_creator_id;
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.record_post_view(uuid, uuid) from public, anon, authenticated;
revoke all on function public.toggle_post_like(uuid, uuid) from public, anon, authenticated;
revoke all on function public.toggle_creator_follow(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_post_view(uuid, uuid) to service_role;
grant execute on function public.toggle_post_like(uuid, uuid) to service_role;
grant execute on function public.toggle_creator_follow(uuid, uuid) to service_role;
