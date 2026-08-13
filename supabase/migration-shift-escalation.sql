-- Per-admin shift end hour (Manila time), used for task escalation.
-- 15 = 3PM (AM shift), 20 = 8PM (supervisor), 23 = 11PM (PM / straight duty),
-- NULL/0 handling: we use a sentinel 0 to mean "Rest day — no escalation".
-- New admins default to 15 (3PM / AM shift). Run once. Safe to re-run.

alter table staff add column if not exists shift_end_hour int not null default 15;

-- Set the current schedule you described. Adjust anytime in the app
-- (Manage staff), or re-run this with new values.
-- Malabon: Francis AM (3PM), Loraine PM (11PM)
-- Manila:  Emman AM (3PM), Andre PM (11PM)
-- Supervisor: Ela 8PM
update staff set shift_end_hour = 15 where username in ('francis','emman');
update staff set shift_end_hour = 23 where username in ('loraine','andre');
update staff set shift_end_hour = 20 where username = 'ela';
