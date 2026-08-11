-- Public creator page serials: every profile gets a permanent 5-digit id
-- starting from 00151, used in public URLs as /<username><serial>.
create sequence if not exists public.profile_serial_seq start with 151;

alter table public.profiles
  add column if not exists public_serial integer;

-- Backfill existing profiles in signup order
update public.profiles p
set public_serial = s.serial
from (
  select id, 150 + row_number() over (order by created_at, id) as serial
  from public.profiles
  where public_serial is null
) s
where p.id = s.id;

-- Keep the sequence ahead of the backfilled values
select setval(
  'public.profile_serial_seq',
  greatest(coalesce((select max(public_serial) from public.profiles), 150), 150) + 1,
  false
);

alter table public.profiles
  alter column public_serial set default nextval('public.profile_serial_seq'),
  alter column public_serial set not null;

create unique index if not exists uq_profiles_public_serial
  on public.profiles (public_serial);
