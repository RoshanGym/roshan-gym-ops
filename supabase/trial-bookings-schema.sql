-- =====================================================================
-- Roshan Gym Ops — FREE Trial Booking log
-- Run in Supabase SQL Editor. Small file, safe to paste in one go.
-- Columns map 1:1 to the Google Form "Roshan Gym - Free Trial Booking Form".
-- Writes come from the app's server-side Supabase client (Apps Script never
-- touches the DB directly), so this reuses your existing write path / RLS.
-- =====================================================================

create table if not exists public.trial_bookings (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  submitted_at              timestamptz,                    -- Google Form timestamp

  -- ---- PERSONAL INFORMATION ----
  full_name                 text not null,
  mobile_number             text,
  email                     text not null,
  gender                    text,                           -- Male / Female / Other
  gender_other              text,
  age                       int,

  -- ---- TRIAL BOOKING (as requested by the applicant) ----
  preferred_branch          text,                           -- Malabon / Manila
  preferred_time            text,                           -- e.g. "12:00 PM"
  preferred_date            date,
  service                   text,                           -- Personal training / HIIT-Circuit /
                                                            -- Boxing / MuayThai / Taekwondo / Gym Access

  -- ---- FITNESS INFORMATION ----
  fitness_goal              text,                           -- Weight Loss / Weight Gain / Build Muscle / Build Strength-Endurance
  exercise_frequency        text,
  exercise_frequency_other  text,
  injuries_medical          text,
  heard_about_us            text,
  heard_about_us_other      text,
  referral                  text,
  consent_physically_able   boolean,
  consent_follow_rules      boolean,
  consent_schedule_subject  boolean,

  -- full title->answer map from Apps Script, so nothing is ever lost even if a
  -- field title changes on the form. The API maps this into the columns above.
  raw                       jsonb,

  -- ---- ADMIN / CONTROL PANEL ----
  status                    text not null default 'Pending'
                              check (status in ('Pending','Approved','Reschedule','Completed')),
  confirmed_service         text,
  confirmed_branch          text,
  confirmed_date            date,
  confirmed_time            text,
  reschedule_reason         text,
  admin_notes               text,
  approved_at               timestamptz,
  confirmation_email_sent_at timestamptz,
  daypass_email_sent_at     timestamptz
);

create index if not exists trial_bookings_status_idx     on public.trial_bookings (status);
create index if not exists trial_bookings_created_at_idx on public.trial_bookings (created_at desc);

-- verify (their convention: end with a count)
select count(*) as trial_bookings_rows from public.trial_bookings;   -- expect 0 on first run
