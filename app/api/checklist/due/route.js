import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';
import { weekStartOf, materialize } from '../../../../lib/checklist';

export const dynamic = 'force-dynamic';

// Reports unfinished tasks that are DUE for the signed-in user:
//  - today's daily tasks still open
//  - this week's weekly tasks still open
//  - OVERDUE: daily tasks from earlier days, and weekly tasks from earlier
//    weeks, that were never Done or Skipped (i.e. genuinely missed).
export const GET = withApi(async (req) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const url = new URL(req.url);
  const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekStart = weekStartOf(today);

  await materialize(db, session.id, today);

  const { data: entries, error } = await db
    .from('task_entries')
    .select('id, title, frequency, status, period_date')
    .eq('staff_id', session.id)
    .neq('status', 'Done')
    .neq('status', 'Skipped');
  if (error) throw error;

  const openToday = [];
  const openThisWeek = [];
  const overdue = [];
  (entries || []).forEach((e) => {
    if (e.frequency === 'Daily') {
      if (e.period_date === today) openToday.push(e);
      else if (e.period_date < today) overdue.push(e);
    } else {
      if (e.period_date === weekStart) openThisWeek.push(e);
      else if (e.period_date < weekStart) overdue.push(e);
    }
  });

  return ok({
    date: today,
    openToday: openToday.length,
    openThisWeek: openThisWeek.length,
    overdue: overdue.length,
    overdueSample: overdue.slice(0, 5).map((e) => e.title),
    total: openToday.length + openThisWeek.length + overdue.length,
  });
});
