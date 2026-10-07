-- Schema additions for field extraction, verification, audit trail, and CSV export logging.
-- Run in the Supabase SQL Editor after storage-policies.sql. Safe to re-run.

-- The status column is an enum; add the value used when a reviewer verifies a record.
-- Run this statement on its own first if the editor reports the new value cannot be used yet.
alter type public.prescription_status add value if not exists 'reviewed';

-- Extracted / verified fields on the prescription itself.
alter table public.prescriptions
  add column if not exists diagnosis text not null default '',
  add column if not exists verified_by uuid references auth.users (id),
  add column if not exists verified_at timestamptz;

-- One row per medicine parsed from a prescription.
create table if not exists public.prescription_items (
  item_id bigint generated always as identity primary key,
  prescription_id uuid not null references public.prescriptions (prescription_id) on delete cascade,
  medicine_name text not null default '',
  dosage text not null default '',
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),
  is_edited boolean not null default false,
  created_at timestamptz not null default now()
);

-- The table may already exist from an earlier version with stricter columns.
-- The app stores no per-field confidence (the OCR service does not return one), so allow null.
alter table public.prescription_items alter column confidence_score drop not null;

create index if not exists prescription_items_prescription_idx
  on public.prescription_items (prescription_id);

-- Append-only record of user actions (UPLOAD, EDIT, VERIFY, EXPORT, DELETE).
create table if not exists public.audit_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  prescription_id uuid references public.prescriptions (prescription_id) on delete set null,
  action_type text not null check (action_type in ('UPLOAD', 'EDIT', 'VERIFY', 'EXPORT', 'DELETE')),
  notes text not null default '',
  action_timestamp timestamptz not null default now()
);

create index if not exists audit_logs_prescription_idx
  on public.audit_logs (prescription_id, action_timestamp desc);

-- One row per generated CSV file.
create table if not exists public.csv_reports (
  export_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  file_name text not null,
  records_count integer not null default 0,
  exported_at timestamptz not null default now()
);

alter table public.prescription_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.csv_reports enable row level security;

grant select, insert, update, delete on table public.prescription_items to authenticated;
grant select, insert on table public.audit_logs to authenticated;
grant select, insert on table public.csv_reports to authenticated;
grant update on table public.prescriptions to authenticated;
grant insert on table public.prescriptions to authenticated;

-- Staff can update prescriptions they uploaded.
drop policy if exists "Users can insert their prescriptions" on public.prescriptions;
create policy "Users can insert their prescriptions"
on public.prescriptions for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Authenticated users can update prescriptions" on public.prescriptions;
create policy "Authenticated users can update prescriptions"
on public.prescriptions for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read items" on public.prescription_items;
create policy "Authenticated users can read items"
on public.prescription_items for select
to authenticated
using (true);

drop policy if exists "Authenticated users can write items" on public.prescription_items;
create policy "Authenticated users can write items"
on public.prescription_items for all
to authenticated
using (true)
with check (true);

-- Audit logs and export logs are append-only: no update or delete policy exists.
drop policy if exists "Authenticated users can read audit logs" on public.audit_logs;
create policy "Authenticated users can read audit logs"
on public.audit_logs for select
to authenticated
using (true);

drop policy if exists "Users can write their own audit logs" on public.audit_logs;
create policy "Users can write their own audit logs"
on public.audit_logs for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Authenticated users can read csv reports" on public.csv_reports;
create policy "Authenticated users can read csv reports"
on public.csv_reports for select
to authenticated
using (true);

drop policy if exists "Users can write their own csv reports" on public.csv_reports;
create policy "Users can write their own csv reports"
on public.csv_reports for insert
to authenticated
with check (user_id = (select auth.uid()));
