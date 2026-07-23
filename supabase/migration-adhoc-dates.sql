-- Ad-hoc tasks: add a due/completion-target date. The existing "date" column
-- serves as the start date. Run once. Safe to re-run.
alter table tasks add column if not exists due_date date;
