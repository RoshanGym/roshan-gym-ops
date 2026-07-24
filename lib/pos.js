// Parser + mapping for the POS "Sales Summary by Category" CSV export.
//
// The export looks like:
//   "Sales Summary by Category"
//   Period,"2026-07-24 to 2026-07-24"
//   Staff,"Emmannoel Dichosa"
//   (blank)
//   Category,Item,Qty,Amount
//   Walk-in,"GYM ACCESS",22,2020.00
//   ...
//   "Walk-in Subtotal",,,3360.00
//   "GRAND TOTAL",,,4730.00
//
// POS "Category" column  -> Availment (Walk-in / Membership Fees / Subscription ...)
// POS "Item" column      -> Tracker Category (via ITEM_MAP)

// Map a POS item name to your tracker category + optional martial-arts discipline.
const ITEM_RULES = [
  { match: /gym\s*access/i,                 category: 'GYM' },
  { match: /hiit|circuit/i,                 category: 'HIIT' },
  { match: /boxing|fighter\s*fee/i,         category: 'MARTIAL ARTS', discipline: 'Boxing' },
  { match: /muay\s*thai/i,                  category: 'MARTIAL ARTS', discipline: 'Muay Thai' },
  { match: /taekwondo/i,                    category: 'MARTIAL ARTS', discipline: 'Taekwondo' },
  { match: /martial/i,                      category: 'MARTIAL ARTS', discipline: '' },
  { match: /personal\s*training|^pt\b/i,    category: 'PERSONAL TRAINING' },
  { match: /membership|subscription/i,      category: 'MEMBERSHIP' },
  { match: /studio\s*rental|rent/i,         category: 'OTHERS', note: 'Studio rental' },
  { match: /treadmill/i,                    category: 'OTHERS', note: 'Treadmill use' },
];

// Availment values (POS "Category") that represent a subscription and therefore
// need a New/Renew choice.
const SUBSCRIPTION_AVAILMENTS = [/subscription/i, /membership\s*fee/i];

// POS categories that are merchandise/drinks and must NOT be imported as sales.
const EXCLUDED_AVAILMENTS = [/product/i, /inventory/i, /merchandise|drinks|supplement/i];

function mapItem(item) {
  for (const rule of ITEM_RULES) {
    if (rule.match.test(item)) {
      return { category: rule.category, discipline: rule.discipline || '', note: rule.note || '' };
    }
  }
  return { category: 'OTHERS', discipline: '', note: '', unmapped: true };
}

function isSubscriptionAvailment(availment) {
  return SUBSCRIPTION_AVAILMENTS.some((r) => r.test(availment));
}
function isExcludedAvailment(availment) {
  return EXCLUDED_AVAILMENTS.some((r) => r.test(availment));
}

// Minimal CSV splitter that respects double-quoted fields.
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Parse the whole report. Returns { period, staff, lines[], grandTotal, warnings[] }.
function parsePosReport(text) {
  const rawLines = text.split(/\r?\n/);
  const result = { periodStart: null, periodEnd: null, staff: null, lines: [], grandTotal: null, warnings: [] };
  let inTable = false;

  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    const first = (cells[0] || '').trim();
    const firstLow = first.toLowerCase();

    if (firstLow === 'period') {
      const val = (cells[1] || '').trim();
      const m = val.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/i);
      if (m) { result.periodStart = m[1]; result.periodEnd = m[2]; }
      continue;
    }
    if (firstLow === 'staff') { result.staff = (cells[1] || '').trim(); continue; }
    if (firstLow === 'category' && (cells[1] || '').toLowerCase() === 'item') { inTable = true; continue; }
    if (firstLow === 'grand total') {
      result.grandTotal = parseFloat(cells[3] || cells[cells.length - 1] || '') || 0;
      continue;
    }
    if (!inTable) continue;
    if (/subtotal/i.test(first)) continue; // subtotal rows are informational

    // A real data row has Category, Item, Qty, Amount
    const availment = first;
    const item = (cells[1] || '').trim();
    const qty = parseInt(cells[2] || '0', 10) || 0;
    const amount = parseFloat(cells[3] || '0') || 0;
    if (!item && !amount) continue;

    result.lines.push({ availment, item, qty, amount });
  }

  return result;
}

module.exports = {
  parsePosReport,
  mapItem,
  isSubscriptionAvailment,
  isExcludedAvailment,
  ITEM_RULES,
};
