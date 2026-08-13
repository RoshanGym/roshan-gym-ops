# Roshan Gym Ops — project context for Claude Code

Ops/POS app for Roshan Gym (branches: Manila, Malabon). This file is the running
handoff; keep it updated.

## Stack & deploy
- Next.js + Supabase (Postgres), hosted on Vercel. Repo `RoshanGym/roshan-gym-ops`,
  branch `main`, Vercel project `roshan-gym-ops-stq3`.
- Front end is a single vanilla-JS SPA at `public/app.js` (no framework/build): global
  scope, a `SECTIONS` array drives the Admin nav, a global `state`, and `renderContent()`
  / `renderModal()` dispatch by `state.section` / `state.modal.type`. It talks ONLY to
  `/api/*` routes.
- API routes under `/api/*` hold the Supabase **service-role** key server-side
  (`lib/supabase.js`). The browser never gets a Supabase key.

## Working conventions (important)
- Ship code via **real git commits**. Never use Vercel "Redeploy" to pick up changes.
- SQL is run in the **Supabase SQL Editor**. The editor truncates large pastes silently,
  so keep import files under ~30 KB, split by month, and end every file with a
  `select count(*)` so a truncated paste is caught immediately.
- Only ever have ONE destructive `delete` per import group, isolated in a `*-00-RESET`
  file. Month/chunk files must be append-only. (A `delete` living inside a month file
  once wiped Feb–Jul when it re-ran — don't repeat that.)
- After any deploy, smoke-test a write.

## Data model notes
- `sales` table rows carry an `import_batch` + `source` tag:
  - `historical-monthly-2026` / `pos-monthly` — core monthly POS aggregates (Jan–Jul, 677 rows).
  - `historical-merch-2026` — drinks/merch (verified 345 rows / ₱435,921).
  - `admin-tracker-2026` / `admin-tracker` — per-transaction admin tracker.
  - `POS-2026-08-*` — live current-month entries (leave alone).
  The "Actual vs Target by month" view sums `sales.amount` by month; it reads core to the peso.
- `trial_bookings` table backs the Free Trial Booking feature (see below).
- `members` table backs the Membership Tracker (see below). Historical rows carry
  `created_by = 'Historical import'` and a deterministic `HIST-####` id (distinct from the
  app's own `M-<n>` runtime id sequence, so there's no collision).

## Current status
- Sales reload: core Jan–Jul loaded (677). **Merch**: table currently holds a *different*
  320-row set (₱447,221) vs the verified 345/₱435,921 — decide which is authoritative before
  overwriting. **Admin**: NOT loaded; the only source found is 4,896 per-transaction rows,
  but the original brief expected 219 — needs a decision on which dataset is correct.
- Free Trial Booking: fully built, pending deploy (steps below).
- Membership Tracker: rebuilt (see below), historical backfill SQL generated and ready to run
  in Supabase.

## Feature: FREE Trial Booking
Online free-trial registration via a Google Form (https://forms.gle/gh6ZQseNB5aL3QAeA).
Architecture: **app = control panel; Apps Script = receives the form + sends Gmail.**
- Intake: Form submit -> intake Apps Script (`onTrialFormSubmit`) -> `POST /api/trial-intake`
  (secret-protected) -> insert `trial_bookings` row (status `Pending`).
- Dashboard: new "FREE Trial Booking" section under Admin in `public/app.js` (metrics,
  filterable table, Details/Approve/Reschedule/Send-day-pass modals). Class services
  (HIIT/Circuit, Boxing, MuayThai, Taekwondo) must land on a real class slot from the
  branch schedule (embedded in app.js; source of truth `trial-class-schedule.json`);
  Personal training and Gym Access take a free date/time.
- Actions: `POST /api/trial-bookings/:id/action` with `{action:'approve'|'reschedule'|'daypass', ...}`
  updates the row and calls the send Apps Script Web App, which sends Gmail (confirmation /
  reschedule / day-pass). Both Apps Scripts run under `fitnessroshan@gmail.com` — that account
  is the Gmail sender for these emails and owns the Google Form (so it's also the "receiver" of
  form-submission notifications).
- Day-pass QR: uploaded once from the "Free Trial Booking" dashboard section (`POST
  /api/trial-qr`), stored in the Supabase `attachments` bucket under `trial/`, and read back
  server-side in `lib/trial.js` (`getDaypassQr`) to send as a base64 attachment (`qrBase64` +
  `qrContentType`) in the `daypass` payload to the send Apps Script. No Google Drive file ID —
  re-uploading from the dashboard replaces it in place. `handleAction` returns a 400 if a
  `daypass` action is attempted before one's been uploaded.
- Files: `sql/trial-bookings-schema.sql`, `lib/trial.js`, the four `/api/trial-*` routes
  (Pages- and App-router versions provided), `roshan-trial-intake.gs`, `roshan-trial-send.gs`.
  The send script's `daypass` branch needs updating to attach `qrBase64`/`qrContentType` from
  the request body (via `Utilities.newBlob(...)`) instead of `DriveApp.getFileById(QR_FILE_ID)`.

### Deploy checklist (remaining)
1. Run `trial-bookings-schema.sql` in Supabase (creates `trial_bookings`). ✅ done.
2. Commit `public/app.js`, `lib/trial.js`, and the `/api/trial-*` routes (match the repo's
   router). Admin session guard is wired at `requireSession()` in the two `trial-bookings`
   routes (same check `/api/auth/me` uses); `trial-intake` stays public/secret-only.
3. Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (already set), plus
   `TRIAL_INTAKE_SECRET`, `APPS_SCRIPT_SEND_URL`, `APPS_SCRIPT_SEND_SECRET` (new).
4. Send Apps Script (standalone, under `fitnessroshan@gmail.com`) — update the `daypass`
   branch to attach `qrBase64`/`qrContentType` instead of pulling from Drive; deploy as Web
   app; Script Properties `SEND_SECRET` (= `APPS_SCRIPT_SEND_SECRET`). No `QR_FILE_ID` needed.
5. Intake Apps Script (bound to the Form, under `fitnessroshan@gmail.com`) — set `API_URL` +
   `SHARED_SECRET` (= `TRIAL_INTAKE_SECRET`); add an On-form-submit trigger.
6. Upload the day-pass QR from the dashboard's "Free Trial Booking" section (Upload QR code
   button) — required before any day-pass email can send.
7. Smoke test: submit form -> Pending row -> Approve (pick slot) -> confirmation email ->
   Send day pass -> QR email. Test Reschedule too.
Secret pairs must match: `SHARED_SECRET` = `TRIAL_INTAKE_SECRET`; send `SEND_SECRET` = `APPS_SCRIPT_SEND_SECRET`.

## Feature: Membership Tracker
Active/expiring/expired dashboard for gym memberships. Every membership is Annual, flat ₱600,
expiry = start date + 1 year (confirmed by the owner — no other plan/pricing exists today).
- Dashboard: "Membership tracker" section in `public/app.js` (`renderMembership`). Metrics +
  filter include Active / Expiring within 2 weeks / Expired / **Needs review** (historical rows
  the import couldn't cleanly reconcile — ambiguous name match, unreadable date, etc.) /
  Missing membership form (informational only, not required).
- **Adding members has one path now: "Upload New Member"** (`renderNewMemberModal` in
  `public/app.js`, despite the old name). No more scanned-form/OCR step — that was removed
  entirely (the OCR endpoint `app/api/members/scan/route.js` is deleted) since scans, if kept,
  live on a separate drive and the POS report is the source of truth going forward. Flow: pick
  the day's POS report (xlsx/csv, parsed client-side via the `XLSX` global already loaded in
  `public/app.html`) -> match its columns to Name/Branch/Date/Amount/etc (auto-guessed,
  overridable — no fixed POS report schema assumed) -> editable per-row grid for the fields a
  POS report won't carry (t-shirt size, t-shirt released date, keyfob released date for Malabon
  only, source) -> `POST /api/members/check-duplicates` (member no. first, then name+branch) ->
  skip/import-anyway per duplicate -> `POST /api/members/bulk-import` commits the batch (one row
  behaves the same as fifty) and returns a same-day cross-check against the Sales Tracker's
  Annual Membership total (`sales.item ilike '%annual%'`, sum/600 = expected count) as a
  non-blocking warning banner.
- Required before a row can upload: t-shirt size, source, amount > 0, t-shirt released date, and
  (Malabon only) keyfob released date — enforced client-side (`memberRowMissingFields` in
  `public/app.js`) and again server-side (`validateMemberRow` in `lib/members.js`, shared by both
  `/api/members` and `/api/members/bulk-import`).
- Schema: `supabase/migration-members-form.sql` (base fields) +
  `supabase/migration-membership-tracker-3.sql` (`tshirt_released_date`, `keyfob_released_date`,
  `member_no`, `needs_review`). Both already run.
- **Historical backfill (2025 Members List, New Members 2026, Client Information Sheet from the
  owner's Excel tracker)**: reconciled offline (see this repo's chat history for the full
  methodology — no Node/Python on this machine, so it was done via a one-off PowerShell XLSX
  parser, not checked into the repo) into 2,788 member rows, deduped by name (owner's call: a
  repeated name is the same person, most recent 2026 date wins — not two different people).
  1 record (no date anywhere in the source) was intentionally skipped, not imported. SQL files
  are ready in `supabase/`: `import-members-00-reset.sql` (the one delete, isolated per
  convention) + `import-members-01.sql` … `import-members-34.sql` (append-only chunks, each
  ending in `select count(*)`). **Not yet run in Supabase** — run the reset file once, then all
  34 chunk files in order, in the SQL Editor.
