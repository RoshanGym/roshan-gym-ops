import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, requireRole, tierFor, SUPER_ADMIN_ROLES } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

function nowIso() { return new Date().toISOString(); }

async function loadRequest(db, id) {
  const { data, error } = await db.from('requests').select('*').eq('id', id).single();
  if (error) {
    const err = new Error('Request not found.');
    err.status = 404;
    throw err;
  }
  return data;
}

// SOFT DELETE. The record stays in the database, marked deleted with who/when,
// and a line is added to its history. It disappears from all normal views but
// remains reviewable and restorable by Super Admins from the PO Tracker.
export const DELETE = withApi(async (req, { params }) => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const db = supabaseAdmin();
  const r = await loadRequest(db, params.id);
  if (r.deleted_at) {
    const err = new Error('This request is already deleted.');
    err.status = 400;
    throw err;
  }
  const history = Array.isArray(r.history) ? r.history : [];
  history.push({ at: nowIso(), text: 'Request deleted (moved to deleted items — restorable)', by: session.name, role: session.role });
  const { data, error } = await db
    .from('requests')
    .update({ deleted_at: nowIso(), deleted_by: session.name, history })
    .eq('id', params.id)
    .select('*, attachments(*)')
    .single();
  if (error) throw error;
  return ok({ request: data });
});

// Edit a request while it's still awaiting approval — after that, the
// approval chain (checks, receipts, POS entries) depends on the amount/
// line items staying put, so editing is locked the moment it moves past
// "Pending Approval".
export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const r = await loadRequest(db, params.id);

  if (r.status !== 'Pending Approval') {
    const err = new Error('Only requests still awaiting approval can be edited.');
    err.status = 400;
    throw err;
  }
  if (tierFor(session.role) !== 'SuperAdmin' && r.created_by_id && r.created_by_id !== session.id) {
    const err = new Error('You can only edit your own requests.');
    err.status = 403;
    throw err;
  }

  const body = await req.json();
  const history = Array.isArray(r.history) ? r.history : [];
  let update = {};

  if (r.type === 'PO') {
    const { branch, supplier, payee, lineItems, notes } = body;
    const validRows = (lineItems || []).filter((x) => x.item && x.item.trim() && x.qty > 0);
    const amount = validRows.reduce((s, x) => s + x.qty * x.cost, 0);
    if (!supplier || !payee || validRows.length === 0 || amount <= 0) {
      const err = new Error('Supplier, payee, and at least one valid line item are required.');
      err.status = 400;
      throw err;
    }
    const title =
      validRows.map((x) => x.item).slice(0, 2).join(', ') +
      (validRows.length > 2 ? ` +${validRows.length - 2} more` : '');
    update = {
      title,
      payee,
      amount,
      notes: notes || '',
      branch,
      supplier,
      line_items: validRows.map((x) => ({ item: x.item, qty: x.qty, cost: x.cost, total: x.qty * x.cost })),
    };
  } else {
    const { title, payee, amount, notes } = body;
    if (!title || !payee || !amount || amount <= 0) {
      const err = new Error('Fill in what this is for, the payee, and a valid amount.');
      err.status = 400;
      throw err;
    }
    update = { title, payee, amount, notes: notes || '' };
  }

  history.push({ at: nowIso(), text: 'Request edited before approval', by: session.name, role: session.role });
  update.history = history;

  const { data, error } = await db
    .from('requests')
    .update(update)
    .eq('id', params.id)
    .select('*, attachments(*)')
    .single();
  if (error) throw error;
  return ok({ request: data });
});

// RESTORE (action: 'restore') and PERMANENT PURGE (action: 'purge').
// Purge only works on a request that is already soft-deleted, so permanent
// removal is always a deliberate two-step act, never a single click.
export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const db = supabaseAdmin();
  const { action } = await req.json();
  const r = await loadRequest(db, params.id);

  if (action === 'restore') {
    if (!r.deleted_at) {
      const err = new Error('This request is not deleted.');
      err.status = 400;
      throw err;
    }
    const history = Array.isArray(r.history) ? r.history : [];
    history.push({ at: nowIso(), text: 'Request restored from deleted items', by: session.name, role: session.role });
    const { data, error } = await db
      .from('requests')
      .update({ deleted_at: null, deleted_by: null, history })
      .eq('id', params.id)
      .select('*, attachments(*)')
      .single();
    if (error) throw error;
    return ok({ request: data });
  }

  if (action === 'purge') {
    if (!r.deleted_at) {
      const err = new Error('Only requests already in deleted items can be permanently removed. Delete it first.');
      err.status = 400;
      throw err;
    }
    const { data: atts, error: attErr } = await db
      .from('attachments')
      .select('storage_path')
      .eq('request_id', params.id);
    if (attErr) throw attErr;
    if (atts && atts.length) {
      const paths = atts.map((a) => a.storage_path).filter(Boolean);
      if (paths.length) await db.storage.from('attachments').remove(paths);
    }
    const { error } = await db.from('requests').delete().eq('id', params.id);
    if (error) throw error;
    return ok({ success: true, purged: params.id });
  }

  const err = new Error('Unknown action.');
  err.status = 400;
  throw err;
});
