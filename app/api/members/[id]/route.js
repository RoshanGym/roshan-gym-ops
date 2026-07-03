import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

const PLAN_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12, 'Class pack': 0 };

export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
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
