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
// record. Returns a list of human-readable error strings (empty = valid).
export function validateMemberRow(row) {
  const errors = [];
  if (!row.name || !String(row.name).trim()) errors.push('Name is required.');
  if (!row.branch) errors.push('Branch is required.');
  if (!row.startDate) errors.push('Membership date is required.');
  if (!row.tshirtSize) errors.push('T-shirt size is required.');
  if (!row.source) errors.push('Source is required.');
  if (!(Number(row.amount) > 0)) errors.push('Amount paid must be greater than 0.');
  if (!row.tshirtReleasedDate) errors.push('T-shirt released date is required.');
  if (row.branch === 'Malabon' && !row.keyfobReleasedDate) errors.push('Keyfob released date is required for Malabon.');
  return errors;
}
