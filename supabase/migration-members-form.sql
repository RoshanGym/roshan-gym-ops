-- Membership tracker upgrade: fields matching the Excel tracker, plus the
-- scanned membership form attached to each member record.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table members add column if not exists branch text default '';
alter table members add column if not exists tshirt_size text default '';
alter table members add column if not exists status text default 'New';
alter table members add column if not exists source text default '';
alter table members add column if not exists remarks text default '';
alter table members add column if not exists form_path text;
alter table members add column if not exists form_name text;
alter table members add column if not exists form_uploaded_by text;
alter table members add column if not exists form_uploaded_at timestamptz;
