-- Admin role for platform operators (separate from creator/user).

alter table public.user_accounts drop constraint if exists user_accounts_role_check;

alter table public.user_accounts add constraint user_accounts_role_check
  check (role in ('creator', 'user', 'admin'));
