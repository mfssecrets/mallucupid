-- Posts: 12-char public id, multi-media storage paths, content validation, private media bucket.

alter table public.posts
  add column if not exists public_id text,
  add column if not exists media_paths text[] not null default '{}';

-- Backfill any existing rows with a random 12-char alphanumeric id
update public.posts
set public_id = upper(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 12))
where public_id is null;

alter table public.posts alter column public_id set not null;
create unique index if not exists idx_posts_public_id on public.posts (public_id);

-- Media now lives in the private bucket as storage paths; legacy media_url kept optional
alter table public.posts alter column media_url drop not null;
alter table public.posts alter column media_url set default '';

alter table public.posts drop constraint if exists posts_caption_length;
alter table public.posts add constraint posts_caption_length
  check (char_length(caption) <= 200);

-- Paid posts require a minimum price of 10 INR; free posts must be 0
alter table public.posts drop constraint if exists posts_paid_price_min;
alter table public.posts add constraint posts_paid_price_min
  check ((is_paid = false and price = 0) or (is_paid = true and price >= 10));

alter table public.posts drop constraint if exists posts_media_paths_limit;
alter table public.posts add constraint posts_media_paths_limit
  check (
    (media_type = 'image' and array_length(media_paths, 1) between 1 and 15)
    or (media_type = 'video' and array_length(media_paths, 1) = 1)
  );

-- Private storage bucket for post media (served via signed URLs only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  524288000, -- 500 MB
  array['image/jpeg', 'image/png', 'video/*']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: creators manage only their own posts (service role bypasses; policies protect direct API access)
drop policy if exists "Creators can view own posts" on public.posts;
create policy "Creators can view own posts"
  on public.posts for select
  using (auth.uid() = creator_id);

drop policy if exists "Creators can insert own posts" on public.posts;
create policy "Creators can insert own posts"
  on public.posts for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can update own posts" on public.posts;
create policy "Creators can update own posts"
  on public.posts for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can delete own posts" on public.posts;
create policy "Creators can delete own posts"
  on public.posts for delete
  using (auth.uid() = creator_id);

-- Storage RLS: creators can only touch media inside their own folder ({user_id}/...)
drop policy if exists "Creators read own post media" on storage.objects;
create policy "Creators read own post media"
  on storage.objects for select
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Creators upload own post media" on storage.objects;
create policy "Creators upload own post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Creators delete own post media" on storage.objects;
create policy "Creators delete own post media"
  on storage.objects for delete
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
