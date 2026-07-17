import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';
import { weekStartOf, materialize } from '../../../lib/checklist';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const url = new URL(req.url);
  const dateStr = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const staffId = url.searchParams.get('staff') || session.id;

  if (staffId !== session.id && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error("Not authorized to view another staff member's checklist.");
    err.status = 403;
    throw err;
  }

  await materialize(db, staffId, dateStr);
  const weekStart = weekStartOf(dateStr);

  const { data: entries, error } = await db
    .from('task_entries')
    .select('*, task_files(*)')
    .eq('staff_id', staffId)
    .or(`and(frequency.eq.Daily,period_date.eq.${dateStr}),and(frequency.eq.Weekly,period_date.eq.${weekStart})`)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  return ok({ date: dateStr, weekStart, entries });
});
