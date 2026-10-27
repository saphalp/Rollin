begin;

-- Storage path of the profile cover image. Lives in the existing `avatars` bucket under the owner's
-- `<user-id>/` folder (same as profile_picture), so the bucket's existing per-user policies apply.
-- Null means the app shows its bundled default cover.
alter table public.profiles add column if not exists cover_picture text;

commit;
