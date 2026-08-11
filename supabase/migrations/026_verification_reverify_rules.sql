-- Verification production rules:
-- 1) First submit → immediate verified badge
-- 2) Admin may suspend after the fact
-- 3) After suspend: first 3 resubmits auto-verify; 4th+ requires admin approval (pending)
-- 4) While badge inactive (suspended/pending/unverified), public content is locked (enforced in edge function)

alter table public.profiles
  drop constraint if exists profiles_verification_status_check;

alter table public.profiles
  add constraint profiles_verification_status_check
  check (verification_status in ('unverified', 'pending', 'verified', 'suspended', 'rejected'));

alter table public.creator_verifications
  drop constraint if exists creator_verifications_status_check;

alter table public.creator_verifications
  add constraint creator_verifications_status_check
  check (status in ('pending', 'verified', 'suspended', 'rejected'));

-- Lifetime count of auto-reverifies after suspension (max 3 auto; 4th+ is pending).
alter table public.creator_verifications
  add column if not exists auto_reverify_count integer not null default 0
  check (auto_reverify_count >= 0);

comment on column public.creator_verifications.auto_reverify_count is
  'Number of post-suspension resubmits that were auto-verified. After 3, further resubmits stay pending for admin.';

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
