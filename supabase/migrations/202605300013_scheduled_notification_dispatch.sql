alter table notifications
  add column if not exists deduplication_key text;

alter table notifications
  drop constraint if exists notifications_organization_user_deduplication_key_key;

alter table notifications
  add constraint notifications_organization_user_deduplication_key_key
  unique (organization_id, user_id, deduplication_key);
