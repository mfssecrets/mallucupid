-- 027_platform_fee_breakdown_fix.sql
-- Corrects the backfill done in 027: net_to_creator_paise must equal amount_paise
-- (creator receives the full content amount; the 3% fee is added ON TOP of the
-- content amount and paid by the user), and final_amount_paise must equal
-- amount_paise + platform_fee_paise (what the user actually paid via Razorpay).

update public.post_purchases
  set platform_fee_percent = 3.00,
      platform_fee_paise   = round(coalesce(amount_paise, round(amount * 100)::integer) * 0.03)::integer,
      net_to_creator_paise = coalesce(amount_paise, round(amount * 100)::integer),
      final_amount_paise   = coalesce(amount_paise, round(amount * 100)::integer)
                             + round(coalesce(amount_paise, round(amount * 100)::integer) * 0.03)::integer
  where true;

update public.exclusive_room_subscriptions
  set platform_fee_percent = 3.00,
      platform_fee_paise   = round(amount_paise * 0.03)::integer,
      net_to_creator_paise = amount_paise,
      final_amount_paise   = amount_paise + round(amount_paise * 0.03)::integer
  where true;
