import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { newRequestId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

function nowIso() { return new Date().toISOString(); }

export const GET = withApi(async () => {
  const session = requireSession();
  const db = supabaseAdmin();
  let query = db
    .from('requests')
    .select('*, attachments(*)')
    .order('created_at', { ascending: false });
  if (tierFor(session.role) !== 'SuperAdmin') {
    query = query.is('deleted_at', null).eq('created_by_id', session.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ok({ requests: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
    const err = new Error('Only Admin accounts create requests.');
    err.status = 403;
    throw err;
  }
  const body = await req.json();
  const db = supabaseAdmin();

  if (body.type === 'PO') {
    const { branch, supplier, payee, lineItems, notes } = body;
    const validRows = (lineItems || []).filter((r) => r.item && r.item.trim() && r.qty > 0);
    const amount = validRows.reduce((s, r) => s + r.qty * r.cost, 0);
    if (!supplier || !payee || validRows.length === 0 || amount <= 0) {
      const err = new Error('Supplier, payee, and at least one valid line item are required.');
      err.status = 400;
      throw err;
    }
    const id = await newRequestId('PO', branch);
    const title =
      validRows.map((r) => r.item).slice(0, 2).join(', ') +
      (validRows.length > 2 ? ` +${validRows.length - 2} more` : '');
    const record = {
      id,
      type: 'PO',
      title,
      payee,
      amount,
      notes: notes || '',
      branch,
      supplier,
      payment_method: 'Check',
      requestor: session.name,
      line_items: validRows.map((r) => ({ item: r.item, qty: r.qty, cost: r.cost, total: r.qty * r.cost })),
      status: 'Pending Approval',
      created_by: session.name,
      created_by_id: session.id,
      history: [{ at: nowIso(), text: 'Request created and sent for approval', by: session.name, role: session.role }],
    };
    const { data, error } = await db.from('requests').insert(record).select('*, attachments(*)').single();
    if (error) throw error;
    return ok({ request: data });
  }

  if (body.type === 'PettyCash') {
    const { title, payee, amount, notes } = body;
    if (!title || !payee || !amount || amount <= 0) {
      const err = new Error('Fill in what this is for, the payee, and a valid amount.');
      err.status = 400;
      throw err;
    }
    const id = await newRequestId('PettyCash');
    const record = {
      id,
      type: 'PettyCash',
      title,
      payee,
      amount,
      notes: notes || '',
      payment_method: 'Cash',
      requestor: session.name,
      line_items: [],
      status: 'Pending Approval',
      created_by: session.name,
      created_by_id: session.id,
      history: [{ at: nowIso(), text: 'Request created and sent for approval', by: session.name, role: session.role }],
    };
    const { data, error } = await db.from('requests').insert(record).select('*, attachments(*)').single();
    if (error) throw error;
    return ok({ request: data });
  }

  const err = new Error('Unknown request type.');
  err.status = 400;
  throw err;
});
