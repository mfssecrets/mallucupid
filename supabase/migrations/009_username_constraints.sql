-- Enforce username rules at the database level:
-- 6-25 chars, only letters/numbers/underscore/dot/hyphen, and case-insensitive uniqueness.

-- Case-insensitive uniqueness (e.g. "Founder" and "founder" cannot both exist)
create unique index if not exists uq_profiles_username_lower
  on public.profiles (lower(username));

-- Format constraint for all new/updated rows (NOT VALID so legacy rows don't break the migration)
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9._-]{6,25}$') not valid;
