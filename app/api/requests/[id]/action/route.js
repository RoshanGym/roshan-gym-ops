import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireSession, requireRole, tierFor } from '../../../../../lib/auth';
import { withApi, ok } from '../../../../../lib/api';

function nowIso() { return new Date().toISOString(); }
function fmt(n) { return Number(n || 0).toFixed(2); }

async function loadRequest(db, id) {
  const { data, error } = await db.from('requests').select('*, attachments(*)').eq('id', id).single();
  if (error) {
    const err = new Error('Request not found.');
    err.status = 404;
    throw err;
  }
  return data;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const body = await req.json();
  const action = body.action;
  const r = await loadRequest(db, params.id);

  // Privacy: an Admin can only act on requests they created. Super Admins
  // (Supervisor/Owner) act on any request as the workflow requires.
  if (tierFor(session.role) !== 'SuperAdmin' && r.created_by_id && r.created_by_id !== session.id) {
    const err = new Error('You can only act on your own requests.');
    err.status = 403;
    throw err;
  }

  const history = Array.isArray(r.history) ? r.history : [];
  const log = (text) => history.push({ at: nowIso(), text, by: session.name, role: session.role });

  let update = {};

  if (action === 'approve') {
    requireRole(session, ['Supervisor']);
    if (r.status !== 'Pending Approval') badRequest('This request is not awaiting approval.');
    update.status = 'Approved';
    update.approval = { approvedBy: session.name, approvedAt: nowIso() };
    log('Approved by supervisor');

  } else if (action === 'reject') {
    requireRole(session, ['Supervisor']);
    if (r.status !== 'Pending Approval') badRequest('This request is not awaiting approval.');
    const reason = (body.reason || '').trim();
    if (!reason) badRequest('Add a reason so the admin knows what to fix.');
    update.status = 'Rejected';
    update.approval = { approvedBy: session.name, approvedAt: nowIso(), reason };
    log('Rejected: ' + reason);

  } else if (action === 'resubmit') {
    requireRole(session, ['Admin']);
    if (r.status !== 'Rejected') badRequest('This request has not been rejected.');
    update.status = 'Pending Approval';
    update.approval = {};
    log('Resubmitted for approval');

  } else if (action === 'check') {
    requireRole(session, ['Owner']);
    if (r.status !== 'Approved') badRequest('This request has not been approved yet.');
    const number = (body.number || '').trim();
    const date = body.date || nowIso().slice(0, 10);
    const amount = parseFloat(body.amount);
    if (!number) badRequest('Enter the reference number.');
    if (!amount || amount <= 0) badRequest('Enter a valid amount.');
    if (r.payment_method === 'Check') {
      const { data: clash } = await db
        .from('requests')
        .select('id')
        .neq('id', r.id)
        .eq('payment_method', 'Check')
        .contains('check_info', { number })
        .maybeSingle();
      if (clash) badRequest(`Check #${number} is already recorded on ${clash.id}. Double-check the number.`);
    }
    update.status = 'Check Prepared';
    update.check_info = { number, date, amount, preparedBy: session.name, preparedAt: nowIso() };
    log(`${r.payment_method || 'Check'} #${number} prepared for PHP ${fmt(amount)}, dated ${date}`);

  } else if (action === 'confirm-receipt') {
    requireRole(session, ['Supervisor']);
    if (r.status !== 'Check Prepared') badRequest('No payment is awaiting receipt confirmation.');
    update.status = 'Check Received by Supervisor';
    update.receipt = { confirmedBy: session.name, confirmedAt: nowIso() };
    log(`Supervisor confirmed receipt of #${r.check_info?.number || ''}`);

  } else if (action === 'confirm-handover') {
    requireRole(session, ['Admin']);
    if (r.status !== 'Check Received by Supervisor') badRequest('This request is not awaiting handover confirmation.');
    update.status = 'Handed to Admin';
    update.handover = { confirmedBy: session.name, confirmedAt: nowIso() };
    log(`Admin confirmed receiving #${r.check_info?.number || ''} from supervisor`);

  } else if (action === 'delivery') {
    requireRole(session, ['Admin']);
    if (r.status !== 'Handed to Admin') badRequest('This request is not awaiting delivery confirmation.');
    const notes = (body.notes || '').trim();
    const isPO = r.type === 'PO';

    if (isPO) {
      const hasReceiptFile = (r.attachments || []).some((a) => a.label === 'Delivery receipt / invoice');
      if (!hasReceiptFile) badRequest('Attach the delivery receipt or invoice first.');
      const deliveredAmount = parseFloat(body.deliveredAmount);
      const checkAmount = r.check_info?.amount != null ? r.check_info.amount : r.amount;
      if (!deliveredAmount || deliveredAmount < 0) badRequest('Enter the amount shown on the delivery receipt.');
      const variance = Math.round((deliveredAmount - checkAmount) * 100) / 100;
      if (variance !== 0 && !notes) {
        badRequest(`The delivery amount does not match the check (PHP ${fmt(checkAmount)}). Add a note explaining why.`);
      }
      update.delivery = {
        confirmedBy: session.name,
        confirmedAt: nowIso(),
        notes,
        deliveredAmount,
        variance,
        varianceStatus: variance !== 0 ? 'Needs resolution' : 'Matched',
      };
      if (variance !== 0) {
        log(`Delivery logged at PHP ${fmt(deliveredAmount)} vs check PHP ${fmt(checkAmount)} — variance of PHP ${fmt(Math.abs(variance))} flagged for resolution. ${notes}`);
      } else {
        log('Delivery received and filed, amount matches the check' + (notes ? ' — ' + notes : ''));
      }
    } else {
      update.delivery = { confirmedBy: session.name, confirmedAt: nowIso(), notes, deliveredAmount: r.amount, variance: 0, varianceStatus: 'Matched' };
      log('Reimbursement paid out' + (notes ? ' — ' + notes : ''));
    }
    update.status = 'Delivered';

  } else if (action === 'pos') {
    requireRole(session, ['Admin', 'Owner']);
    if (r.status !== 'Delivered') badRequest('This request is not awaiting POS recording.');
    const reference = (body.reference || '').trim();
    const hasScreenshot = (r.attachments || []).some((a) => a.label === 'POS entry screenshot');
    if (!reference && !hasScreenshot) badRequest('Enter a POS reference, attach a screenshot of the entry, or both.');
    update.status = 'Recorded in POS';
    update.pos = { recordedBy: session.name, recordedAt: nowIso(), reference: reference || null, hasScreenshot };
    log('Recorded in POS' + (reference ? ' as ' + reference : '') + (hasScreenshot ? ' with screenshot attached' : '') + ' — request closed');

  } else if (action === 'resolve-variance') {
    requireRole(session, ['Supervisor', 'Owner']);
    if (!r.delivery || r.delivery.varianceStatus !== 'Needs resolution') badRequest('No open variance on this request.');
    const resolution = body.resolution || 'Other';
    const notes = (body.notes || '').trim();
    update.delivery = { ...r.delivery, varianceStatus: 'Resolved', resolution, resolutionNotes: notes, resolvedBy: session.name, resolvedAt: nowIso() };
    log('Payment variance resolved: ' + resolution + (notes ? ' — ' + notes : ''));

  } else {
    badRequest('Unknown action.');
  }

  update.history = history;
  const { data, error } = await db.from('requests').update(update).eq('id', r.id).select('*, attachments(*)').single();
  if (error) throw error;
  return ok({ request: data });
});
