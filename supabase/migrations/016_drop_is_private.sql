-- Private accounts were never enforced on public pages and are no longer part of the product.
alter table public.profiles drop column if exists is_private;
