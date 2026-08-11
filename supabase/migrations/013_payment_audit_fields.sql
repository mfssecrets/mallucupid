-- Immutable purchase audit fields for reliable post-wise access and payment
-- reconciliation. Existing rows can be inferred from their linked post.
alter table public.post_purchases
  add column if not exists creator_id uuid references auth.users(id) on delete set null,
  add column if not exists amount_paise integer,
  add column if not exists provider text not null default 'razorpay',
  add column if not exists verified_at timestamptz;

update public.post_purchases pp
set creator_id = p.creator_id,
    amount_paise = round(pp.amount * 100)::integer
from public.posts p
where p.id = pp.post_id
  and (pp.creator_id is null or pp.amount_paise is null);

alter table public.post_purchases
  add constraint post_purchases_amount_paise_positive
  check (amount_paise is null or amount_paise > 0);

create index if not exists idx_post_purchases_order
  on public.post_purchases (razorpay_order_id);
