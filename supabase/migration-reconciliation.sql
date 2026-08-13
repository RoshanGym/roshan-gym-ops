-- Bank reconciliation: lets Owners/Supervisors tick off each payment once it
-- has been matched against the bank statement.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table requests add column if not exists reconciled_at timestamptz;
alter table requests add column if not exists reconciled_by text;

create index if not exists requests_check_date_idx on requests ((check_info->>'date'));
