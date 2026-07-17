-- Daily Task Checklist system: recurring task templates per employee,
-- daily/weekly checklist entries, and proof-of-completion files.
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  assignee text,
  title text not null,
  section text default '',
  frequency text not null check (frequency in ('Daily','Weekly')),
  category text default '',
  sort_order int not null default 0,
  active boolean not null default true,
  seed_tag text
);

create table if not exists task_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references task_templates(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  assignee text,
  title text not null,
  section text default '',
  frequency text not null,
  category text default '',
  sort_order int not null default 0,
  period_date date not null,
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Done','Skipped')),
  completed_at timestamptz,
  completed_by text,
  remarks text default '',
  unique (template_id, period_date)
);

create index if not exists task_entries_staff_period_idx on task_entries (staff_id, period_date);

create table if not exists task_files (
  id uuid primary key default gen_random_uuid(),
  task_entry_id uuid not null references task_entries(id) on delete cascade,
  name text,
  mime text,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

alter table task_templates enable row level security;
alter table task_entries enable row level security;
alter table task_files enable row level security;

-- Task checklist templates seeded from the Team Task Management workbook.
-- Safe to re-run: clears and re-inserts only rows tagged seed_v1.
delete from task_templates where seed_tag = 'seed_v1';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Admin Turnover - If there are any issues/problems reported', '', 'Daily', 'Admin', 1, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Admin Breaktime - Cover front desk & check al gc announcements', '', 'Daily', 'Admin', 2, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check employee attendance', '', 'Daily', 'Reports', 3, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check coaches status - report, gather feedback/suggestions', '', 'Daily', 'Systems', 4, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check email messages for Roshan & own gmail', '', 'Daily', 'Reports', 5, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create daily reports', '', 'Daily', 'Reports', 6, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Proceed to others task tracker', '', 'Daily', 'Reports', 7, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Break time at 2:00', '', 'Daily', '', 8, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Continue w/ task tracker for projects/others', '', 'Daily', 'Project', 9, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Cover inquiries for peak hours', '', 'Daily', 'Admin', 10, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Send welcome message for new members', '', 'Daily', 'Admin', 11, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Open TV for visuals', '', 'Daily', 'Reports', 12, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Socialize with the client', '', 'Daily', 'Admin', 13, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Prepare Mancom Presentation', '', 'Weekly', 'Meeting', 1, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check P.O requests', '', 'Weekly', 'Admin', 2, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Petty Cash Replenishment', '', 'Weekly', 'Admin', 3, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Admin hiring interview', '', 'Weekly', 'Admin', 4, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'HRIS Change shift for shifting schedule every cut off', '', 'Weekly', 'Systems', 5, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'PO records completeness', '', 'Weekly', 'Reports', 6, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Leave tracker updates', '', 'Weekly', 'Reports', 7, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'MuayThai Tracker for commission', '', 'Weekly', 'Finance', 8, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Investigate Gears pictures completion', '', 'Weekly', 'Admin', 9, 'seed_v1' from staff where username = 'ela';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Receive cash turnover (beginning cash + any sales)', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 1, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Count drinks and check wiith inventory', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 2, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Receive instructions from AM Shift', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 3, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record last shift''s sales (beyond cut off) in Gears POS', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 4, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check inventories of drinks, egg/banana, and supplements', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 5, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Post Bring A Friend poster and Online Booking and Admin Hiring', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 6, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that the reception is clean and presentable. Wipe down your table and dispose all trashes.', 'During the shift', 'Daily', 'Admin', 7, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Answer page inquiries and comments', 'During the shift', 'Daily', 'Admin', 8, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Take pictures/video of GYM and classes and post in FB', 'During the shift', 'Daily', 'Admin', 9, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Bank Deposit', 'During the shift', 'Daily', 'Admin', 10, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Assist to walk in clients / offer membership and monthly plans or other services', 'During the shift', 'Daily', 'Admin', 11, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record sales to Gears POS', 'During the shift', 'Daily', 'Admin', 12, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Share to public groups and Roshan Group postings with engaging caption', 'During the shift', 'Daily', 'Admin', 13, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check cleaners checklist and confirm if tasks were completed', 'During the shift', 'Daily', 'Admin', 14, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that all membership were in gears with complete details (required information, pictures, etc)', 'During the shift', 'Daily', 'Admin', 15, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Always update BIR Receipts and Book recording', 'During the shift', 'Daily', 'Admin', 16, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check email for freezing / and online booking request in Gears', 'During the shift', 'Daily', 'Admin', 17, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check online booking module in gears if there is booking.', 'During the shift', 'Daily', 'Admin', 18, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Closing Inventory - Cash and Drinks', 'Closing Tasks', 'Daily', 'Admin', 19, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check if all expenses were recorded in Gears (check gc)', 'Closing Tasks', 'Daily', 'Admin', 20, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Sales Tracker', 'Closing Tasks', 'Daily', 'Admin', 21, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Members''s List tracker and upload membership forms in drive', 'Closing Tasks', 'Daily', 'Admin', 22, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Send inventory to GC', 'Closing Tasks', 'Daily', 'Admin', 23, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover cash and inventories to Fhe /Ron', 'Closing Tasks', 'Daily', 'Admin', 24, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Clear all page inquiries', 'Closing Tasks', 'Daily', 'Admin', 25, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover Juanwhey Sales to Rochelle', 'Closing Tasks', 'Daily', 'Admin', 26, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Clean reception', 'Closing Tasks', 'Daily', 'Admin', 27, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Transfer Gcash to AUB Account', 'Closing Tasks', 'Daily', 'Admin', 28, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Keyfob tracker', 'Closing Tasks', 'Daily', 'Admin', 29, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Save sales report from gears to drive', 'Closing Tasks', 'Daily', 'Admin', 30, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Trace inactive members with active subscription', '', 'Weekly', 'Admin', 1, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Purchase Order Creation', '', 'Weekly', 'Admin', 2, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Disposal of membership forms already filed', '', 'Weekly', 'Admin', 3, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Official Receipt and Cash Receipts', '', 'Weekly', 'Admin', 4, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create class schedule poster for next week', '', 'Weekly', 'Admin', 5, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Review my sales performance for the week', '', 'Weekly', 'Feedback', 6, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create plan for New Leads, Retention and Referral system for next week', '', 'Weekly', 'Growth', 7, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Document number of conversions, rejections and missed sales opportunities for the week (what went well, what went wrong, what needs to be improved)', '', 'Weekly', 'Growth', 8, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Petty Cash Turnover for replenishment', '', 'Weekly', 'Admin', 9, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Think of one process improvement in our current system', '', 'Weekly', 'Growth', 10, 'seed_v1' from staff where username = 'andre';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Prepare tablet and scanner', 'Opening Tasks: 6AM to 2PM Shift', 'Daily', 'Admin', 1, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Count cash in drawer and check if it tallies with beginning balance + last shift''s sales', 'Opening Tasks: 6AM to 2PM Shift', 'Daily', 'Admin', 2, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Count drinks and check wiith inventory', 'Opening Tasks: 6AM to 2PM Shift', 'Daily', 'Admin', 3, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record last shift''s sales (beyond cut off) in Gears POS', 'Opening Tasks: 6AM to 2PM Shift', 'Daily', 'Admin', 4, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Send GC Invite (Class Schedule and operating hours)', 'Opening Tasks: 6AM to 2PM Shift', 'Daily', 'Admin', 5, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that the reception is clean and presentable. Wipe down your table and dispose all trashes.', 'During the shift', 'Daily', 'Admin', 6, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Answer page inquiries and comments', 'During the shift', 'Daily', 'Admin', 7, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Take pictures/video of GYM and classes and post in FB', 'During the shift', 'Daily', 'Admin', 8, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check facilities and turn off lights/fans not using', 'During the shift', 'Daily', 'Admin', 9, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Assist to walk in clients / offer membership and monthly plans or other services', 'During the shift', 'Daily', 'Admin', 10, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record sales to Gears POS', 'During the shift', 'Daily', 'Admin', 11, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Share to public groups and Roshan Group postings with engaging caption', 'During the shift', 'Daily', 'Admin', 12, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that all membership were in gears with complete details (required information, pictures, etc)', 'During the shift', 'Daily', 'Admin', 13, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check cleaners checklist and confirm if done', 'During the shift', 'Daily', 'Admin', 14, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check email for any freezing request and initiatiate request in gears', 'During the shift', 'Daily', 'Admin', 15, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check and confirm online booking in Gears', 'During the shift', 'Daily', 'Admin', 16, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Cash Deposit', 'During the shift', 'Daily', 'Admin', 17, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Closing Inventory - Cash and Drinks', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 18, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check if all expenses were recorded in Gears', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 19, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Run Sales Report in Gears, Update Sales Tracker, Save sales report to drive', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 20, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Member''s list tracker and upload membership forms to drive', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 21, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover cash and inventories to PM Shift', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 22, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Clear all page inquiries', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 23, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover any issues/information needed', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 24, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that gym weights and accessories were re-rack and organized', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 25, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Send Inventory to GC', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 26, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover Meats and Supplements sales to Rochelle', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 27, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Keyfob tracker', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 28, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Save sales report from gears to drive', 'Closing Tasks (AM Shift)', 'Daily', 'Admin', 29, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Trace inactive members with active subscription', '', 'Weekly', 'Admin', 1, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Purchase Order Creation', '', 'Weekly', 'Admin', 2, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Disposal of membership forms already filed', '', 'Weekly', 'Admin', 3, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Official Receipt and Cash Receipts', '', 'Weekly', 'Admin', 4, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create class schedule poster for next week', '', 'Weekly', 'Admin', 5, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Review my sales performance for the week', '', 'Weekly', 'Growth', 6, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create plan for New Leads, Retention and Referral system for next week', '', 'Weekly', 'Growth', 7, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Document number of conversions, rejections and missed sales opportunities for the week (what went well, what went wrong, what needs to be improved)', '', 'Weekly', 'Growth', 8, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Petty Cash Turnover for replenishment', '', 'Weekly', 'Admin', 9, 'seed_v1' from staff where username = 'francis';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Receive cash turnover (beginning cash + any sales)', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 1, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Count drinks and check wiith inventory', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 2, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Receive instructions from AM Shift', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 3, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record last shift''s sales (beyond cut off) in Gears POS', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 4, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check inventories of drinks, egg/banana, and supplements', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 5, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Open all trackers needed to update during the shift (Member''s List Tracker, Membership Drive)', 'Opening Tasks: 2PM to 11PM Shift', 'Daily', 'Admin', 6, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that the reception is clean and presentable. Wipe down your table and dispose all trashes.', 'During the shift', 'Daily', 'Admin', 7, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Answer page inquiries and comments', 'During the shift', 'Daily', 'Admin', 8, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Take pictures/video of GYM and classes and post in FB', 'During the shift', 'Daily', 'Admin', 9, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Bank Deposit', 'During the shift', 'Daily', 'Admin', 10, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Assist to walk in clients / offer membership and monthly plans or other services', 'During the shift', 'Daily', 'Admin', 11, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record sales to Gears POS', 'During the shift', 'Daily', 'Admin', 12, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Share to public groups and Roshan Group postings with engaging caption', 'During the shift', 'Daily', 'Admin', 13, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check cleaners checklist and confirm if tasks were completed', 'During the shift', 'Daily', 'Admin', 14, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Make sure that all membership were in gears with complete details (required information, pictures, etc)', 'During the shift', 'Daily', 'Admin', 15, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update BIR Receipts and Book recording', 'During the shift', 'Daily', 'Admin', 16, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check email request for freezing', 'During the shift', 'Daily', 'Admin', 17, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Check online booking module in gears if there is booking.', 'During the shift', 'Daily', 'Admin', 18, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Member''s List tracker once there is membership enrollment', 'During the shift', 'Daily', 'Admin', 19, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Closing Inventory - Cash and Drinks', 'Closing Tasks', 'Daily', 'Admin', 20, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Record Expenses in Gears, send End of day Purchase Order payment (receiving of checks) via email', 'Closing Tasks', 'Daily', 'Admin', 21, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Update Sales Tracker', 'Closing Tasks', 'Daily', 'Admin', 22, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Save membership form in drive', 'Closing Tasks', 'Daily', 'Admin', 23, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Send inventory to GC', 'Closing Tasks', 'Daily', 'Admin', 24, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Turnover cash and inventories to Fhe /Ron', 'Closing Tasks', 'Daily', 'Admin', 25, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Clear all page inquiries', 'Closing Tasks', 'Daily', 'Admin', 26, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Clean reception', 'Closing Tasks', 'Daily', 'Admin', 27, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Transfer Gcash to AUB Account', 'Closing Tasks', 'Daily', 'Admin', 28, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Save sales report from gears to drive', 'Closing Tasks', 'Daily', 'Admin', 29, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Trace inactive members with active subscription', '', 'Weekly', 'Admin', 1, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Purchase Order Creation', '', 'Weekly', 'Admin', 2, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Disposal of membership forms already filed', '', 'Weekly', 'Admin', 3, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Official Receipt and Cash Receipts', '', 'Weekly', 'Admin', 4, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create class schedule poster for next week', '', 'Weekly', 'Admin', 5, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Review my sales performance for the week', '', 'Weekly', 'Growth', 6, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Create plan for New Leads, Retention and Referral system for next week', '', 'Weekly', 'Growth', 7, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Document number of conversions, rejections and missed sales opportunities for the week (what went well, what went wrong, what needs to be improved)', '', 'Weekly', 'Growth', 8, 'seed_v1' from staff where username = 'loraine';
insert into task_templates (staff_id, assignee, title, section, frequency, category, sort_order, seed_tag) select id, name, 'Petty Cash Turnover for replenishment', '', 'Weekly', 'Admin', 9, 'seed_v1' from staff where username = 'loraine';