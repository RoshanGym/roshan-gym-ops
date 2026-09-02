// lib/trial.js — Free Trial Booking server logic (self-contained, final).
// Uses its own service-role Supabase client so it doesn't depend on your
// existing lib/supabase.js. If you'd rather reuse yours, replace `supabase`
// below with your server client — the handlers are unchanged.
//
// Required env vars (Vercel project settings):
//   SUPABASE_URL                 your project URL
//   SUPABASE_SERVICE_ROLE_KEY    service role key (server only)
//   TRIAL_INTAKE_SECRET          shared with the intake Apps Script (SHARED_SECRET)
//   APPS_SCRIPT_SEND_URL         deployed send Web App URL
//   APPS_SCRIPT_SEND_SECRET      shared with the send Apps Script (SEND_SECRET)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const TABLE = 'trial_bookings';

// Google Forms' Apps Script `item.getTitle()` returns the question text
// verbatim, notes and all (e.g. "Preferred Time\n\nNote: Please ensure your
// time availability."), and the live form's actual wording drifts from
// whatever this was written against. Exact-string lookups are brittle
// against that, so match on the normalized *start* of the title instead —
// exact match first (fast path), then a whitespace-collapsed prefix match.
function findAnswer(answers, label) {
  if (Object.prototype.hasOwnProperty.call(answers, label)) return answers[label];
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(label);
  const key = Object.keys(answers).find((k) => norm(k).startsWith(target));
  return key ? answers[key] : undefined;
}

// ---------- intake: Google Form -> Apps Script -> here ----------
export async function handleIntake(body) {
  if (!body || body.secret !== process.env.TRIAL_INTAKE_SECRET) {
    return { status: 401, json: { error: 'unauthorized' } };
  }
  const a = body.answers || {};
  const get = (label) => findAnswer(a, label) || '';
  const genderRaw = get('Gender');
  const consent = findAnswer(a, 'Consent: By submitting this form, I confirm that:') || [];
  const consentArr = Array.isArray(consent) ? consent : [consent];
  const has = (needle) => consentArr.some((c) => String(c).toLowerCase().includes(needle));

  const row = {
    submitted_at: body.submitted_at || new Date().toISOString(),
    full_name: get('FULL NAME'),
    mobile_number: get('Mobile Number'),
    email: get('Email Address') || body.respondent_email || '',
    gender: ['Male', 'Female'].includes(genderRaw) ? genderRaw : (genderRaw ? 'Other' : ''),
    gender_other: ['Male', 'Female', ''].includes(genderRaw) ? null : genderRaw,
    age: parseInt(get('Age'), 10) || null,
    preferred_branch: get('Preferred Branch'),
    preferred_time: get('Preferred Time'),
    preferred_date: get('Preferred Date') || null,
    service: get('Which service would you like to try?'),
    fitness_goal: get('What is your primary fitness goal?'),
    exercise_frequency: get('How often do you currently exercise?'),
    injuries_medical: get('Do you have any injuries or medical conditions we should know about?'),
    heard_about_us: get('How do you hear about us?'),
    referral: get('If someone referred you, please enter their referral code or name'),
    consent_physically_able: has('physically able'),
    consent_follow_rules: has('rules'),
    consent_schedule_subject: has('schedule'),
    raw: a,
    status: 'Pending',
  };
  if (!row.full_name || !row.email) return { status: 400, json: { error: 'missing name/email' } };

  const { error } = await supabase.from(TABLE).insert(row);
  if (error) return { status: 500, json: { error: error.message } };
  return { status: 200, json: { ok: true } };
}

// ---------- admin: list ----------
export async function handleList() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) return { status: 500, json: { error: error.message } };
  return { status: 200, json: { bookings: data || [] } };
}

// ---------- admin: approve / reschedule / daypass ----------
const QR_BUCKET = 'attachments';
const QR_PREFIX = 'trial';

// The day-pass QR is uploaded once from the Free Trial Booking dashboard
// (POST /api/trial-qr) instead of being pulled from Google Drive by file ID.
async function getDaypassQr() {
  const { data: files, error } = await supabase.storage.from(QR_BUCKET).list(QR_PREFIX);
  if (error || !files || !files.length) return null;
  const file = files[0];
  const { data: blob, error: dlErr } = await supabase.storage.from(QR_BUCKET).download(`${QR_PREFIX}/${file.name}`);
  if (dlErr || !blob) return null;
  const buf = Buffer.from(await blob.arrayBuffer());
  const ext = file.name.split('.').pop().toLowerCase();
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return { base64: buf.toString('base64'), contentType };
}

async function callSend(action, booking, extra) {
  const res = await fetch(process.env.APPS_SCRIPT_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ secret: process.env.APPS_SCRIPT_SEND_SECRET, action, booking }, extra || {})),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) throw new Error(out.error || 'Email send failed');
}

export async function handleAction(id, body) {
  const { data: existing, error: e0 } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (e0 || !existing) return { status: 404, json: { error: 'booking not found' } };

  const nowIso = new Date().toISOString();
  const bookingForEmail = {
    email: existing.email,
    fullName: existing.full_name,
    service: body.service || existing.confirmed_service || existing.service,
    branch: body.branch || existing.confirmed_branch || existing.preferred_branch,
    date: body.date || existing.confirmed_date,
    time: body.time || existing.confirmed_time,
  };
  let patch = {};

  try {
    if (body.action === 'approve') {
      patch = {
        status: 'Approved', approved_at: nowIso,
        confirmed_service: bookingForEmail.service, confirmed_branch: bookingForEmail.branch,
        confirmed_date: bookingForEmail.date, confirmed_time: bookingForEmail.time,
      };
      await callSend('confirmation', bookingForEmail);
      patch.confirmation_email_sent_at = nowIso;
    } else if (body.action === 'reschedule') {
      patch = {
        status: 'Reschedule',
        confirmed_service: bookingForEmail.service, confirmed_branch: bookingForEmail.branch,
        confirmed_date: bookingForEmail.date, confirmed_time: bookingForEmail.time,
        reschedule_reason: body.reason || '',
      };
      await callSend('reschedule', bookingForEmail, { reason: body.reason || '' });
    } else if (body.action === 'daypass') {
      const qr = await getDaypassQr();
      if (!qr) return { status: 400, json: { error: 'No day-pass QR code has been uploaded yet — upload one from the Free Trial Booking section first.' } };
      await callSend('daypass', bookingForEmail, { closing: body.closing || '', qrBase64: qr.base64, qrContentType: qr.contentType });
      patch = { daypass_email_sent_at: nowIso };
    } else if (body.action === 'reject') {
      const reason = (body.reason || '').trim();
      if (!reason) return { status: 400, json: { error: 'Add a reason so it is clear why this was rejected.' } };
      patch = { status: 'Rejected', rejected_at: nowIso, rejected_reason: reason };
    } else if (body.action === 'outcome') {
      const outcome = body.outcome || null;
      if (outcome && outcome !== 'Converted' && outcome !== 'For follow up') {
        return { status: 400, json: { error: 'Unknown outcome.' } };
      }
      patch = { outcome, outcome_at: outcome ? nowIso : null };
    } else {
      return { status: 400, json: { error: 'unknown action' } };
    }
  } catch (err) {
    return { status: 502, json: { error: String(err.message || err) } };
  }

  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single();
  if (error) return { status: 500, json: { error: error.message } };
  return { status: 200, json: { booking: data } };
}
