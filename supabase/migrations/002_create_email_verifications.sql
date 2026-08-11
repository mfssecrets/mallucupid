-- Create email_verifications table for OTP-based signup and password reset
create table if not exists public.email_verifications (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  token text not null,
  purpose text not null, -- 'signup' or 'reset'
  payload jsonb, -- optional extra data (e.g., username)
  attempts int default 0,
  used boolean default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_email_verifications_email on public.email_verifications (email);
create index if not exists idx_email_verifications_token on public.email_verifications (token);
