import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

const PLAN_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12, 'Class pack': 0 };

export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin accounts renew memberships.');
    err.status = 403;
    throw err;
  }
  const { plan, date, amount, customExpiry } = await req.json();
  const db = supabaseAdmin();
  const { data: m, error: getErr } = await db.from('members').select('*').eq('id', params.id).single();
  if (getErr) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }

  const renewDate = date || new Date().toISOString().slice(0, 10);
  let newExpiry;
  if (plan === 'Class pack') {
    if (!customExpiry) {
      const err = new Error('Set the new expiry date for this class pack.');
      err.status = 400;
      throw err;
    }
    newExpiry = customExpiry;
  } else {
    const base = new Date(m.expiry_date) > new Date(renewDate) ? m.expiry_date : renewDate;
    const months = PLAN_MONTHS[plan] || 1;
    const d = new Date(base);
    d.setMonth(d.getMonth() + months);
    newExpiry = d.toISOString().slice(0, 10);
  }

  const history = Array.isArray(m.history) ? m.history : [];
  history.push({ date: renewDate, amount: amount || 0, action: 'Renewal', newExpiry, by: session.name });

  const { data, error } = await db
    .from('members')
    .update({ plan, expiry_date: newExpiry, history })
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) throw error;
  return ok({ member: data });
});

const EDITABLE_FIELDS = {
  name: 'name', contact: 'contact', email: 'email', branch: 'branch', memberNo: 'member_no',
  status: 'status', startDate: 'start_date', expiryDate: 'expiry_date', amount: 'amount',
  tshirtSize: 'tshirt_size', source: 'source', remarks: 'remarks',
};

// General edit — fixing a typo, correcting a duplicate's details, etc. Not
// for renewals (use POST above) or the t-shirt/keyfob release dates and
// form link (their own dedicated routes) — this covers everything else.
export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts edit members.');
    err.status = 403;
    throw err;
  }
  const body = await req.json();
  const update = {};
  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (body[key] !== undefined) update[column] = body[key];
  }
  if (update.name !== undefined && !String(update.name).trim()) {
    const err = new Error('Name is required.');
    err.status = 400;
    throw err;
  }
  if (!Object.keys(update).length) {
    const err = new Error('Nothing to update.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from('members').update(update).eq('id', params.id).select('*').single();
  if (error) throw error;
  if (!data) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }
  return ok({ member: data });
});

// Removes a member record entirely — for duplicate entries created by
// mistake. Best-effort cleanup of an uploaded form file; a Drive link has
// nothing to clean up since it was never stored here.
export const DELETE = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts delete members.');
    err.status = 403;
    throw err;
  }
  const db = supabaseAdmin();
  const { data: m } = await db.from('members').select('form_path').eq('id', params.id).single();
  if (m && m.form_path) {
    await db.storage.from('attachments').remove([m.form_path]);
  }
  const { error } = await db.from('members').delete().eq('id', params.id);
  if (error) throw error;
  return ok({ deleted: true });
});
