import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('sales')
    .select('import_batch, date, entered_by, branch, amount')
    .eq('source', 'pos-import')
    .not('import_batch', 'is', null);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((r) => {
    const b = map.get(r.import_batch) || { batch: r.import_batch, date: r.date, staff: r.entered_by, branch: r.branch, count: 0, total: 0 };
    b.count += 1; b.total += Number(r.amount) || 0;
    map.set(r.import_batch, b);
  });
  const batches = [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return ok({ batches });
});
