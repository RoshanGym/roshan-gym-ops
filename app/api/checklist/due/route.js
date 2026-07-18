import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';
import { weekStartOf, materialize } from '../../../../lib/checklist';

export const dynamic = 'force-dynamic';

const REST_DAY = 0;

function manilaNow() {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return { date: manila.toISOString().slice(0, 10), hour: manila.getUTCHours() };
}

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

  const mNow = manilaNow();
  // This admin's own shift end (default 15 = 3PM). REST_DAY (0) = no escalation.
  const { data: me } = await db.from('staff').select('shift_end_hour').eq('id', session.id).single();
  const shiftEnd = me && me.shift_end_hour != null ? me.shift_end_hour : 15;
  let cutoffPassed = false;
  if (shiftEnd !== REST_DAY) {
    cutoffPassed = (today < mNow.date) || (today === mNow.date && mNow.hour >= shiftEnd);
  }
  const escalated = cutoffPassed && openToday.length > 0;

  return ok({
    date: today,
    openToday: openToday.length,
    openThisWeek: openThisWeek.length,
    overdue: overdue.length,
    overdueSample: overdue.slice(0, 5).map((e) => e.title),
    total: openToday.length + openThisWeek.length + overdue.length,
    cutoffHour: shiftEnd,
    cutoffPassed,
    escalated,
    restDay: shiftEnd === REST_DAY,
  });
});
