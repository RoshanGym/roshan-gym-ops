-- Mica has resigned: deactivate her recurring task templates so her checklist
-- stops generating. Her login and any past records (POs, sales, task history)
-- are untouched. Safe to re-run.
update task_templates
set active = false
where staff_id = (select id from staff where username = 'mica');
