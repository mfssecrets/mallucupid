-- Create public storage bucket for creator profile avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for avatars
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Make display name and bio mandatory at the DB level going forward.
-- Existing rows may have nulls; backfill to empty string before enforcing NOT NULL.
update public.profiles set full_name = coalesce(full_name, '');
update public.profiles set bio = coalesce(bio, '');

alter table public.profiles
  alter column full_name set default '',
  alter column bio set default '';
