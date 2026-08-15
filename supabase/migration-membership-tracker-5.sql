-- Membership tracker upgrade 5: let a member's scanned form be a Google
-- Drive link instead of (or alongside) an uploaded file, since forms are
-- already being saved to Drive as part of the day-to-day workflow.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table members add column if not exists form_url text;
