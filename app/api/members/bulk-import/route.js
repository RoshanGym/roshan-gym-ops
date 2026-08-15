import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../lib/auth';
import { newSimpleId } from '../../../../lib/ids';
import { withApi, ok } from '../../../../lib/api';
import { computeExpiry, validateMemberRow } from '../../../../lib/members';

export const dynamic = 'force-dynamic';

// Commits the accepted rows from an "Upload New Member" POS report in one
// batch (a report with one row works the same as one with fifty — there's no
// separate single-add path anymore). All-or-nothing: if any row is missing a
// required field the whole batch is rejected, matching "don't proceed if
// required fields aren't filled".
export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts add members.');
    err.status = 403;
    throw err;
  }

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) {
    const err = new Error('No rows to import.');
    err.status = 400;
    throw err;
  }

  const rowErrors = [];
  rows.forEach((row, index) => {
    const errors = validateMemberRow(row);
    if (errors.length) rowErrors.push({ index, name: row.name || '(no name)', errors });
  });
  if (rowErrors.length) {
    const err = new Error('Some rows are missing required fields — fill them in before uploading.');
    err.status = 400;
    err.details = rowErrors;
    throw err;
  }

  const db = supabaseAdmin();
  const inserted = [];
  for (const row of rows) {
    const plan = row.plan || 'Annual';
    const status = row.status || 'New';
    const expiry = computeExpiry(row.startDate, plan, row.customExpiry);
    const id = await newSimpleId('M', 'members');
    const amount = Number(row.amount) || 0;
    const { data: member, error } = await db
      .from('members')
      .insert({
        id,
        name: String(row.name).trim(),
        contact: row.contact || '',
        email: row.email || '',
        plan,
        start_date: row.startDate,
        expiry_date: expiry,
        amount,
        branch: row.branch,
        tshirt_size: row.tshirtSize,
        status,
        source: row.source,
        remarks: row.remarks || '',
        tshirt_released_date: row.tshirtReleasedDate || null,
        keyfob_released_date: row.keyfobReleasedDate || null,
        member_no: row.memberNo || '',
        created_by: session.name,
        history: [{ date: row.startDate, amount, action: status === 'Renewal' ? 'Renewal' : 'New', newExpiry: expiry, by: session.name }],
      })
      .select('*')
      .single();
    if (error) throw error;
    inserted.push(member);
  }

  // Cross-check against the Sales Tracker: Annual Membership sells at a flat
  // ₱600, so sum(amount)/600 for that date is the expected membership count.
  const dates = [...new Set(rows.map((r) => r.startDate))];
  const salesCheck = [];
  for (const date of dates) {
    const uploadedCount = rows.filter((r) => r.startDate === date).length;
    const { data: salesRows, error: salesErr } = await db
      .from('sales')
      .select('amount')
      .eq('date', date)
      .ilike('item', '%annual%');
    if (salesErr) throw salesErr;
    const total = (salesRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expectedCount = Math.round(total / 600);
    salesCheck.push({ date, uploadedCount, expectedCount, mismatch: uploadedCount !== expectedCount });
  }

  return ok({ inserted, salesCheck });
});
