-- Storage policies for the private prescription_images bucket.
-- Run this in the Supabase SQL Editor after creating the bucket.

create policy "Users can upload their prescription images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can view their prescription images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their prescription images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete their prescription images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
