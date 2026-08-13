-- Monthly sales targets seeded from your 2026 workbook.
-- Malabon from the TARGETS tab; Manila and combined from the
-- SALES COMMISSION SUMMARY 2026 tab. Adjust anytime in the app.
-- Safe to re-run: clears 2026 targets first.

delete from sales_targets where year = 2026;

-- Malabon (min / medial / max from TARGETS tab; 650k/800k/1.0M, April higher)
insert into sales_targets (id, year, month, branch, min_target, medial_target, max_target) values
  ('T-2026-01-MBN', 2026, 1, 'Malabon', 650000, 800000, 1000000),
  ('T-2026-02-MBN', 2026, 2, 'Malabon', 650000, 800000, 1000000),
  ('T-2026-03-MBN', 2026, 3, 'Malabon', 650000, 800000, 1000000),
  ('T-2026-04-MBN', 2026, 4, 'Malabon', 800000, 900000, 1200000),
  ('T-2026-05-MBN', 2026, 5, 'Malabon', 650000, 800000, 1000000),
  ('T-2026-06-MBN', 2026, 6, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-07-MBN', 2026, 7, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-08-MBN', 2026, 8, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-09-MBN', 2026, 9, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-10-MBN', 2026, 10, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-11-MBN', 2026, 11, 'Malabon', 750000, 850000, 1000000),
  ('T-2026-12-MBN', 2026, 12, 'Malabon', 750000, 850000, 1000000);

-- Manila (Target Quota from commission summary; 850k, April 1.2M)
insert into sales_targets (id, year, month, branch, min_target, medial_target, max_target) values
  ('T-2026-01-MNL', 2026, 1, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-02-MNL', 2026, 2, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-03-MNL', 2026, 3, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-04-MNL', 2026, 4, 'Manila', 1200000, 1400000, 1600000),
  ('T-2026-05-MNL', 2026, 5, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-06-MNL', 2026, 6, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-07-MNL', 2026, 7, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-08-MNL', 2026, 8, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-09-MNL', 2026, 9, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-10-MNL', 2026, 10, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-11-MNL', 2026, 11, 'Manila', 850000, 1000000, 1200000),
  ('T-2026-12-MNL', 2026, 12, 'Manila', 850000, 1000000, 1200000);

-- Combined (Malabon + Manila)
insert into sales_targets (id, year, month, branch, min_target, medial_target, max_target)
select 'T-2026-' || lpad(month::text,2,'0') || '-ALL', year, month, 'All',
       sum(min_target), sum(medial_target), sum(max_target)
from sales_targets where year = 2026 and branch in ('Malabon','Manila')
group by year, month;
