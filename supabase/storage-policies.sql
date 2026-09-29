-- Storage policies for the private prescription_images bucket.
-- Run this in the Supabase SQL Editor after creating the bucket.

alter table public.prescriptions
  add column if not exists source text not null default 'N/A';

-- Allow authenticated staff accounts to view all saved prescriptions and images.
alter table public.prescriptions enable row level security;

grant select on table public.prescriptions to authenticated;

drop policy if exists "Authenticated users can view all prescriptions"
on public.prescriptions;

create policy "Authenticated users can view all prescriptions"
on public.prescriptions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can view all prescription images"
on storage.objects;

create policy "Authenticated users can view all prescription images"
on storage.objects for select
to authenticated
using (bucket_id = 'prescription_images');

drop policy if exists "Users can upload their prescription images"
on storage.objects;

create policy "Users can upload their prescription images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can view their prescription images"
on storage.objects;

create policy "Users can view their prescription images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their prescription images"
on storage.objects;

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

drop policy if exists "Users can delete their prescription images"
on storage.objects;

create policy "Users can delete their prescription images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'prescription_images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
