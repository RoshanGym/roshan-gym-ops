-- Roshan Gym Ops — database schema for Supabase (Postgres)
-- Run this once in the Supabase SQL editor for a new project.
-- Safe to re-run: uses "if not exists" / "on conflict do nothing" where sensible.

create extension if not exists pgcrypto;

-- ============ STAFF (logins) ============
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('Admin','Supervisor','Owner','Coach')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ COUNTERS (atomic sequence generator) ============
create table if not exists counters (
  name text primary key,
  value int not null default 0
);

create or replace function next_seq(counter_name text) returns int as $$
declare
  new_val int;
begin
  insert into counters(name, value) values (counter_name, 1)
  on conflict (name) do update set value = counters.value + 1
  returning value into new_val;
  return new_val;
end;
$$ language plpgsql;

-- ============ PURCHASE ORDERS / PETTY CASH ============
create table if not exists requests (
  id text primary key,                 -- e.g. MNL2026001, PC-2026-0004
  type text not null check (type in ('PO','PettyCash')),
  title text not null,
  payee text,
  amount numeric not null default 0,
  notes text,
  branch text,
  supplier text,
  payment_method text,
  requestor text,
  line_items jsonb not null default '[]',
  status text not null default 'Pending Approval',
  created_by text,
  created_by_id uuid references staff(id),
  created_at timestamptz not null default now(),
  approval jsonb not null default '{}',
  check_info jsonb not null default '{}',
  receipt jsonb not null default '{}',
  handover jsonb not null default '{}',
  delivery jsonb not null default '{}',
  pos jsonb not null default '{}',
  history jsonb not null default '[]'
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references requests(id) on delete cascade,
  name text,
  mime text,
  label text,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

-- ============ DAILY TASKS ============
create table if not exists tasks (
  id text primary key,
  title text not null,
  assignee text not null,
  date date not null,
  notes text,
  status text not null default 'To do',
  created_by text,
  created_at timestamptz not null default now(),
  completed_by text,
  completed_at timestamptz
);

-- ============ SALES TRACKER ============
create table if not exists sales (
  id text primary key,
  date date not null,
  category text not null,
  description text,
  amount numeric not null default 0,
  method text not null,
  entered_by text,
  created_at timestamptz not null default now()
);

-- ============ MEMBERSHIP TRACKER ============
create table if not exists members (
  id text primary key,
  name text not null,
  contact text,
  plan text not null,
  start_date date not null,
  expiry_date date not null,
  amount numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  history jsonb not null default '[]'
);

-- ============ PRODUCTS / PRICELIST ============
create table if not exists products (
  id text primary key,
  item text not null,
  cost numeric not null default 0,
  supplier_keys text[] not null default '{}',
  active boolean not null default true
);

-- ============ SEED DATA ============

-- Default staff. Password for everyone is 'roshan123' — change this
-- immediately after first login (top bar -> Change password).
insert into staff (name, username, password_hash, role) values
  ('Loraine Mesina',   'loraine', crypt('roshan123', gen_salt('bf')), 'Admin'),
  ('Mica Fernandez',   'mica',    crypt('roshan123', gen_salt('bf')), 'Admin'),
  ('Andre Cortez',     'andre',   crypt('roshan123', gen_salt('bf')), 'Admin'),
  ('Francis De Hitta', 'francis', crypt('roshan123', gen_salt('bf')), 'Admin'),
  ('Ela Bonganay',     'ela',     crypt('roshan123', gen_salt('bf')), 'Supervisor'),
  ('Ma. Fhe Onofre',   'fhe',     crypt('roshan123', gen_salt('bf')), 'Owner'),
  ('Ronald Narag',     'ronald',  crypt('roshan123', gen_salt('bf')), 'Owner')
on conflict (username) do nothing;

-- Pricelist seed, pulled from the Purchase Order Tracker spreadsheet.
insert into products (id, item, cost, supplier_keys) values
  ('P1','Cobra',16.25,'{brewmaster_mnl,brewmaster_mbn}'),
  ('P2','Vitamilk',29.08,'{brewmaster_mnl,brewmaster_mbn}'),
  ('P3','Greek Yogurt',35.83,'{brewmaster_mnl,brewmaster_mbn}'),
  ('P4','Vitamilk (JDL)',30.00,'{jdl}'),
  ('P5','Sting',17.50,'{jdl}'),
  ('P6','Gatorade',33.00,'{jdl}'),
  ('P7','Gatorade 500ml',42.08,'{jdl}'),
  ('P8','Summit Water',10.00,'{jdl}'),
  ('P9','Predator',12.00,'{}'),
  ('P10','Le Minerale',11.71,'{leminerale}'),
  ('P11','Pocari Sweat',28.80,'{otsuka_mnl,otsuka_mbn}'),
  ('P12','Pocari 500ml',39.60,'{otsuka_mnl,otsuka_mbn}'),
  ('P13','Nature Spring Water',8.43,'{shawnlourd}'),
  ('P14','Membership Tshirt (S to XL)',125.00,'{mandy}'),
  ('P15','Membership Tshirt (2XL)',130.00,'{mandy}'),
  ('P16','Eco Bag X-Small',8.00,'{mandy}'),
  ('P17','Eco Bag Small',21.00,'{mandy}'),
  ('P18','Eco Bag Medium',24.00,'{mandy}'),
  ('P19','Eco Bag Large',26.00,'{mandy}'),
  ('P20','Eco Bag XL',33.00,'{mandy}'),
  ('P21','Eco Bag XXL',35.00,'{mandy}'),
  ('P22','Key Fob',160.00,'{gears}'),
  ('P23','Prothin Whey 60S (1 Box)',1800.00,'{juanwhey}'),
  ('P24','Prothin Creatine (1 Box)',850.00,'{juanwhey}'),
  ('P25','Prothin Mass (54S)',3850.00,'{juanwhey}'),
  ('P26','Prothin Pre-Game',1000.00,'{juanwhey}'),
  ('P27','Prothin Isolate (10S)',650.00,'{juanwhey}'),
  ('P28','Amino 2222 (20S)',190.00,'{juanwhey}'),
  ('P29','ON Creatine (20S)',400.00,'{juanwhey}'),
  ('P30','CC Heavyweight',37.00,'{juanwhey}'),
  ('P31','Ryse Fuel',180.00,'{juanwhey}'),
  ('P32','Ryse ISO Clear',155.00,'{juanwhey}'),
  ('P33','Blitz',100.00,'{juanwhey}'),
  ('P34','Wispy',1900.00,'{juanwhey}'),
  ('P35','Superyou (1 Box)',620.00,'{juanwhey}'),
  ('P36','Barebells RTD',250.00,'{juanwhey}'),
  ('P37','MS Iso-Hydro',50.00,'{juanwhey}'),
  ('P38','Monster RTD',80.00,'{juanwhey}'),
  ('P39','Starbucks',120.00,'{juanwhey}')
on conflict (id) do nothing;

-- Row Level Security: enabled and locked down with no policies for the
-- anon/authenticated roles, since the browser never talks to Supabase
-- directly in this app — only our Next.js API routes do, using the
-- service role key, which bypasses RLS entirely. This just makes sure
-- that if the anon key ever leaks or gets used by mistake, it can't
-- read or write anything.
alter table staff enable row level security;
alter table requests enable row level security;
alter table attachments enable row level security;
alter table tasks enable row level security;
alter table sales enable row level security;
alter table members enable row level security;
alter table products enable row level security;
alter table counters enable row level security;

-- Private storage bucket for PO/receipt/check attachments and POS screenshots.
-- Kept private (public=false) since files are only ever served through our
-- own /api/attachments/[id] route, which generates short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

