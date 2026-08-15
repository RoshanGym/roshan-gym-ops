-- Membership tracker upgrade 4: split contact into a phone-only "contact"
-- column plus a separate "email" column. Run once in the Supabase SQL
-- editor. Safe to re-run.

alter table members add column if not exists email text default '';
