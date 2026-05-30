drop policy if exists "organization members access attendance" on attendance;

create unique index if not exists attendance_one_open_record_per_user_idx
  on attendance (organization_id, user_id)
  where check_out_time is null;

create policy "authorized members view attendance"
on attendance for select
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or user_id = auth.uid()
  )
);

create policy "members create own attendance"
on attendance for insert
with check (
  organization_id = current_organization_id()
  and user_id = auth.uid()
);

create policy "members update own attendance"
on attendance for update
using (
  organization_id = current_organization_id()
  and user_id = auth.uid()
)
with check (
  organization_id = current_organization_id()
  and user_id = auth.uid()
);

create policy "admins delete attendance"
on attendance for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() = 'admin'
);

drop policy if exists "organization members access social posts" on social_posts;

create policy "social team views posts"
on social_posts for select
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'social_media_manager')
);

create policy "social team creates posts"
on social_posts for insert
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'social_media_manager')
);

create policy "social team updates posts"
on social_posts for update
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'social_media_manager')
)
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'social_media_manager')
);

create policy "social team deletes posts"
on social_posts for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'social_media_manager')
);

drop policy if exists "organization members access notifications" on notifications;

revoke insert, update, delete on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

create policy "members view own notifications"
on notifications for select
using (
  organization_id = current_organization_id()
  and (user_id is null or user_id = auth.uid())
);

create policy "members update own notifications"
on notifications for update
using (
  organization_id = current_organization_id()
  and user_id = auth.uid()
)
with check (
  organization_id = current_organization_id()
  and user_id = auth.uid()
);

drop policy if exists "organization members read attendance media" on storage.objects;
drop policy if exists "organization members upload attendance media" on storage.objects;
drop policy if exists "organization members update own attendance media" on storage.objects;
drop policy if exists "organization members delete own attendance media" on storage.objects;

create policy "authorized members read attendance media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or current_profile_role() in ('admin', 'sales_manager')
  )
);

create policy "members upload own attendance media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "members update own attendance media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "members delete own attendance media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "organization members upload social media" on storage.objects;
drop policy if exists "organization members update own social media" on storage.objects;
drop policy if exists "organization members delete own social media" on storage.objects;

create policy "social team uploads own media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and current_profile_role() in ('admin', 'social_media_manager')
);

create policy "social team updates own media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and current_profile_role() in ('admin', 'social_media_manager')
)
with check (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and current_profile_role() in ('admin', 'social_media_manager')
);

create policy "social team deletes own media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and current_profile_role() in ('admin', 'social_media_manager')
);
