-- Sales Tracker upgrade for POS report imports.
-- Adds the fields the POS export and your 2026 tracker need, plus a batch tag
-- so imported (or sample) data can be removed cleanly later.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table sales add column if not exists branch text default '';
alter table sales add column if not exists availment text default '';       -- POS "Category": Walk-in, Membership Fees, Products, Subscription...
alter table sales add column if not exists discipline text default '';       -- Boxing / Muay Thai / Taekwondo for MARTIAL ARTS
alter table sales add column if not exists sale_kind text default '';        -- 'New' or 'Renew' for subscription lines
alter table sales add column if not exists item text default '';             -- original POS item name (audit trail)
alter table sales add column if not exists qty int default 1;
alter table sales add column if not exists import_batch text;                -- uploaded batches share a tag; null for manual entries
alter table sales add column if not exists source text default 'manual';     -- 'manual' or 'pos-import'

create index if not exists sales_import_batch_idx on sales (import_batch);
create index if not exists sales_date_idx on sales (date);

-- Monthly sales targets (from your TARGETS tab). One row per month per branch,
-- plus an 'All' branch row for the combined target.
create table if not exists sales_targets (
  id text primary key,
  year int not null,
  month int not null,           -- 1-12
  branch text not null default 'All',
  min_target numeric not null default 0,
  medial_target numeric not null default 0,
  max_target numeric not null default 0,
  unique (year, month, branch)
);
