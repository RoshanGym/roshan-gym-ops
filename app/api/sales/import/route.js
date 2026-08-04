import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';
const pos = require('../../../../lib/pos.js');

export const dynamic = 'force-dynamic';

// Admin -> branch (each admin belongs to one branch). Overridable per request.
function branchForStaffName(name) {
  const n = (name || '').toLowerCase();
  if (/emman|andre|mica|michaela|ela\b/.test(n)) return 'Manila';
  if (/francis|loraine|kloe/.test(n)) return 'Malabon';
  return '';
}

// STEP 1: parse an uploaded CSV and return a preview (no writes). The client
// shows the mapped lines, asks New/Renew for subscription lines, and flags issues.
export const POST = withApi(async (req) => {
  const session = requireSession();
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    const err = new Error('Attach the POS category-summary CSV.');
    err.status = 400;
    throw err;
  }
  const text = await file.text();
  const parsed = pos.parsePosReport(text);

  const warnings = [];
  if (!parsed.staff) warnings.push('The file has no Staff line — who made these sales?');
  if (!parsed.periodStart) warnings.push('The file has no Period line — what date is this for?');
  if (parsed.periodStart && parsed.periodEnd && parsed.periodStart !== parsed.periodEnd) {
    warnings.push(`This report spans ${parsed.periodStart} to ${parsed.periodEnd}. Daily uploads are expected — check the export range.`);
  }

  const db = supabaseAdmin();

  // Duplicate check: same staff + date already imported?
  if (parsed.staff && parsed.periodStart) {
    const { data: dupe } = await db
      .from('sales')
      .select('import_batch')
      .eq('date', parsed.periodStart)
      .eq('entered_by', parsed.staff)
      .eq('source', 'pos-import')
      .limit(1);
    if (dupe && dupe.length) {
      warnings.push(`A POS import for ${parsed.staff} on ${parsed.periodStart} already exists. Importing again will create duplicates unless you remove the earlier batch first.`);
    }
  }

  const lines = [];
  let keptSum = 0;     // core services
  let merchSum = 0;    // drinks & merchandise (now imported, tracked separately)
  for (const L of parsed.lines) {
    // isExcludedLine keeps keyfob/access-card as a real sale; true only for actual drinks/products.
    if (pos.isExcludedLine(L.availment, L.item)) {
      merchSum += L.amount;
      lines.push({
        availment: L.availment,
        item: L.item,
        qty: L.qty,
        amount: L.amount,
        category: 'Drinks & Merchandise',
        discipline: '',
        note: 'Merchandise',
        unmapped: false,
        needsKind: false,
        saleKind: '',
        isMerch: true,
      });
      continue;
    }
    const m = pos.mapItem(L.item);
    const isSub = pos.isSubscriptionAvailment(L.availment);
    keptSum += L.amount;
    lines.push({
      availment: L.availment,
      item: L.item,
      qty: L.qty,
      amount: L.amount,
      category: m.category,
      discipline: m.discipline || '',
      note: m.note || '',
      unmapped: !!m.unmapped,
      needsKind: isSub, // subscription -> client must pick New/Renew
      saleKind: isSub ? 'New' : '',
    });
    if (m.unmapped) {
      warnings.push(`"${L.item}" didn't match any known category — it will be filed under OTHERS. Adjust the mapping if that's wrong.`);
    }
  }

  // Grand-total validation: core + merch should equal the file's GRAND TOTAL.
  if (parsed.grandTotal != null) {
    const diff = Math.abs((keptSum + merchSum) - parsed.grandTotal);
    if (diff > 1) {
      warnings.push(`The line items add up to ${(keptSum + merchSum).toFixed(2)} but the file's GRAND TOTAL is ${parsed.grandTotal.toFixed(2)} — the file may be incomplete.`);
    }
  }
  if (!lines.length) warnings.push('No lines to import — nothing would be saved.');

  const branch = branchForStaffName(parsed.staff);
  if (!branch && parsed.staff) warnings.push(`Couldn't match "${parsed.staff}" to a branch — pick one before importing.`);

  return ok({
    preview: {
      staff: parsed.staff,
      date: parsed.periodStart,
      branch,
      grandTotal: parsed.grandTotal,
      keptSum,
      merchSum,
      excludedSum: merchSum, // kept for backward compatibility with the current UI label
      lines,
      warnings,
    },
  });
});

// STEP 2: commit the reviewed lines as a batch.
export const PUT = withApi(async (req) => {
  const session = requireSession();
  const body = await req.json();
  const { date, staff, branch, lines } = body;
  if (!date || !staff || !branch) {
    const err = new Error('Missing date, staff, or branch.');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(lines) || !lines.length) {
    const err = new Error('No lines to import.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  const batch = `POS-${date}-${staff.replace(/\s+/g, '_')}-${Date.now()}`;

  const rows = lines.map((L, i) => ({
    id: `S-${date}-${Date.now()}-${i}`,
    date,
    category: L.category || 'OTHERS',
    description: L.item || '',
    item: L.item || '',
    amount: Number(L.amount) || 0,
    qty: Number(L.qty) || 1,
    method: 'POS',
    branch,
    availment: L.availment || '',
    discipline: L.discipline || '',
    sale_kind: L.needsKind ? (L.saleKind || 'New') : '',
    entered_by: staff,
    import_batch: batch,
    source: 'pos-import',
  }));

  const { error } = await db.from('sales').insert(rows);
  if (error) throw error;

  return ok({ imported: rows.length, batch, total: rows.reduce((s, r) => s + r.amount, 0) });
});

// Remove an imported batch (for sample/test data cleanup).
export const DELETE = withApi(async (req) => {
  requireSession();
  const url = new URL(req.url);
  const batch = url.searchParams.get('batch');
  if (!batch) {
    const err = new Error('No batch specified.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const { error } = await db.from('sales').delete().eq('import_batch', batch);
  if (error) throw error;
  return ok({ success: true, batch });
});
