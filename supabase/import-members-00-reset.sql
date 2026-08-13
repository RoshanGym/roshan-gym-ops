-- Historical member backfill: the single delete for this import group.
-- Safe to re-run before re-importing; matches only rows this import created.
delete from members where created_by = 'Historical import';
