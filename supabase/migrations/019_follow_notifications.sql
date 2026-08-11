-- In-app notifications for new followers.

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'purchase', 'request', 'accept', 'follow'));

create unique index if not exists uq_notifications_follow
  on public.notifications (user_id, actor_id)
  where type = 'follow';
