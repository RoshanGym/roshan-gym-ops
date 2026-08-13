-- Membership tracker upgrade 3: fields for the "Upload New Member" (POS report) flow
-- and the historical Excel backfill. Run once in the Supabase SQL editor. Safe to re-run.

alter table members add column if not exists tshirt_released_date date;
alter table members add column if not exists keyfob_released_date date;
alter table members add column if not exists member_no text default '';
alter table members add column if not exists needs_review boolean not null default false;

create index if not exists members_member_no_idx on members (member_no);
