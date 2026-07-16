import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const PLAN_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12, 'Class pack': 0 };

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('members').select('*').order('expiry_date');
  if (error) throw error;
  return ok({ members: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
    const err = new Error('Only Admin accounts add members.');
    err.status = 403;
    throw err;
  }
  const { name, contact, plan, startDate, amount } = await req.json();
  if (!name) {
    const err = new Error('Enter a name for this member.');
    err.status = 400;
    throw err;
  }
  const start = startDate || new Date().toISOString().slice(0, 10);
  const months = PLAN_MONTHS[plan] || 1;
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + (months || 1));
  const expiryStr = expiry.toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const id = await newSimpleId('M', 'members');
  const { data, error } = await db
    .from('members')
    .insert({
      id, name, contact, plan, start_date: start, expiry_date: expiryStr, amount: amount || 0,
      created_by: session.name,
      history: [{ date: start, amount: amount || 0, action: 'New', newExpiry: expiryStr, by: session.name }],
    })
    .select('*')
    .single();
  if (error) throw error;
  return ok({ member: data });
});
