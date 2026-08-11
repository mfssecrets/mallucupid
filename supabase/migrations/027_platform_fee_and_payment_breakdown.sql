-- 027_platform_fee_and_payment_breakdown.sql
-- Adds platform-fee (3%) audit columns to post_purchases and exclusive_room_subscriptions
-- so the breakdown shown in the Pay-Now dialog (content amount, 3% platform charge, final amount)
-- is always reconciled server-side. Frontend values are NEVER trusted.

alter table public.post_purchases
  add column if not exists platform_fee_percent numeric(5,2) not null default 3.00,
  add column if not exists platform_fee_paise integer not null default 0,
  add column if not exists net_to_creator_paise integer not null default 0,
  add column if not exists final_amount_paise integer not null default 0;

-- Backfill existing rows from amount_paise
update public.post_purchases
  set platform_fee_paise = round(coalesce(amount_paise, round(amount * 100)::integer) * 0.03)::integer,
      net_to_creator_paise = coalesce(amount_paise, round(amount * 100)::integer) - round(coalesce(amount_paise, round(amount * 100)::integer) * 0.03)::integer,
      final_amount_paise = coalesce(amount_paise, round(amount * 100)::integer)
  where final_amount_paise = 0 and amount_paise is not null;

alter table public.exclusive_room_subscriptions
  add column if not exists platform_fee_percent numeric(5,2) not null default 3.00,
  add column if not exists platform_fee_paise integer not null default 0,
  add column if not exists net_to_creator_paise integer not null default 0,
  add column if not exists final_amount_paise integer not null default 0;

update public.exclusive_room_subscriptions
  set platform_fee_paise = round(amount_paise * 0.03)::integer,
      net_to_creator_paise = amount_paise - round(amount_paise * 0.03)::integer,
      final_amount_paise = amount_paise
  where final_amount_paise = 0;
