import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';
import { computeExpiry, validateMemberRow } from '../../../lib/members';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('members').select('*').order('expiry_date');
  if (error) throw error;
  return ok({ members: data });
});

// Adds a single member row. This is the row-level insert the "Upload New
// Member" flow calls once per accepted row from the POS report — there's no
// scanned-form step anymore, so no multipart/file handling here.
export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts add members.');
    err.status = 403;
    throw err;
  }

  const body = await req.json();
  const errors = validateMemberRow(body);
  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 400;
    throw err;
  }

  const plan = body.plan || 'Annual';
  const status = body.status || 'New';
  const expiry = computeExpiry(body.startDate, plan, body.customExpiry);

  const db = supabaseAdmin();
  const id = await newSimpleId('M', 'members');

  const { data: member, error } = await db
    .from('members')
    .insert({
      id,
      name: String(body.name).trim(),
      contact: body.contact || '',
      email: body.email || '',
      plan,
      start_date: body.startDate,
      expiry_date: expiry,
      amount: Number(body.amount) || 0,
      branch: body.branch,
      tshirt_size: body.tshirtSize,
      status,
      source: body.source,
      remarks: body.remarks || '',
      tshirt_released_date: body.tshirtReleasedDate || null,
      keyfob_released_date: body.keyfobReleasedDate || null,
      member_no: body.memberNo || '',
      created_by: session.name,
      history: [{ date: body.startDate, amount: Number(body.amount) || 0, action: status === 'Renewal' ? 'Renewal' : 'New', newExpiry: expiry, by: session.name }],
    })
    .select('*')
    .single();
  if (error) throw error;

  return ok({ member });
});
