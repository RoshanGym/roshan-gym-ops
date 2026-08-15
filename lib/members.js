export const PLAN_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12, 'Class pack': 0 };

// Every membership sold today is Annual (see CLAUDE.md); Class pack survives as a
// legacy option for pre-existing rows with a custom expiry.
export function computeExpiry(startDate, plan, customExpiry) {
  if (plan === 'Class pack') {
    if (!customExpiry) {
      const err = new Error('Set the expiry date for this class pack.');
      err.status = 400;
      throw err;
    }
    return customExpiry;
  }
  const months = PLAN_MONTHS[plan] != null ? PLAN_MONTHS[plan] : 12;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (months || 12));
  return d.toISOString().slice(0, 10);
}

// Normalizes a name for duplicate matching: lowercase, trimmed, collapsed
// whitespace, punctuation stripped. Not meant for display.
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Required fields for a member row coming through the "Upload New Member" (POS
// report) flow: no scanned form anymore — the report + these fields are the
// record. T-shirt size, source, and t-shirt/keyfob released dates are
// deliberately NOT required here — the POS report the upload is built from
// doesn't carry them, so they're filled in later per member from the
// Membership Tracker list (POST /api/members/[id]/details) instead of
// blocking the upload.
// Returns a list of human-readable error strings (empty = valid).
export function validateMemberRow(row) {
  const errors = [];
  if (!row.name || !String(row.name).trim()) errors.push('Name is required.');
  if (!row.branch) errors.push('Branch is required.');
  if (!row.startDate) errors.push('Membership date is required.');
  if (!(Number(row.amount) > 0)) errors.push('Amount paid must be greater than 0.');
  return errors;
}
