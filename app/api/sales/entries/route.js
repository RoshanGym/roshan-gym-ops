import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { requireSalesEditor } from '../../../../lib/sales-access';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

// Bulk actions on sales entries. One endpoint for single-row and multi-row use:
//   { action: 'delete',   ids: [...] }
//   { action: 'reassign', ids: [...], enteredBy: 'Andre' }
// ids are chunked so a large selection doesn't overflow the request URL.
export const POST = withApi(async (req) => {
  const session = requireSession();
  requireSalesEditor(session);

  const { action, ids, enteredBy } = await req.json();
  if (!Array.isArray(ids) || !ids.length) {
    const err = new Error('No entries selected.');
    err.status = 400;
    throw err;
  }
  if (action !== 'delete' && action !== 'reassign') {
    const err = new Error('Unknown action.');
    err.status = 400;
    throw err;
  }
  const name = String(enteredBy || '').trim();
  if (action === 'reassign' && !name) {
    const err = new Error('Enter the admin name.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  let affected = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const q = action === 'delete'
      ? db.from('sales').delete().in('id', chunk)
      : db.from('sales').update({ entered_by: name }).in('id', chunk);
    const { data, error } = await q.select('id');
    if (error) throw error;
    affected += (data || []).length;
  }
  return ok({ action, affected });
});
