-- Soft-delete support for PO / Petty Cash requests.
-- Run this once in the Supabase SQL editor. Safe to re-run.

alter table requests add column if not exists deleted_at timestamptz;
alter table requests add column if not exists deleted_by text;

create index if not exists requests_deleted_at_idx on requests (deleted_at);
