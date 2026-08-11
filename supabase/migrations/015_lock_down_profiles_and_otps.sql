-- Lock down tables that previously had RLS OFF (readable via PostgREST + anon key).
-- Service role used by the auth edge function bypasses RLS.

alter table public.profiles enable row level security;
alter table public.email_verifications enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.email_verifications from anon, authenticated;

-- Hot-path index for OTP lookup (email + purpose + unused)
create index if not exists idx_email_verifications_lookup
  on public.email_verifications (email, purpose, used, expires_at);
