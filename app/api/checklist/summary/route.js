import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';
import { weekStartOf, materialize } from '../../../../lib/checklist';

export const dynamic = 'force-dynamic';

// Rest-day sentinel: shift_end_hour 0 means no escalation that day.
const REST_DAY = 0;

// Current date + hour in Manila (UTC+8), independent of server timezone.
function manilaNow() {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return { date: manila.toISOString().slice(0, 10), hour: manila.getUTCHours() };
}

function statsFor(entries) {
  const daily = entries.filter((e) => e.frequency === 'Daily');
  const weekly = entries.filter((e) => e.frequency === 'Weekly');
  const done = (arr) => arr.filter((e) => e.status === 'Done').length;
  const skipped = (arr) => arr.filter((e) => e.status === 'Skipped').length;
  return {
    dailyTotal: daily.length,
    dailyDone: done(daily),
    dailySkipped: skipped(daily),
    weeklyTotal: weekly.length,
    weeklyDone: done(weekly),
    weeklySkipped: skipped(weekly),
  };
}

export const GET = withApi(async (req) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const url = new URL(req.url);
  const dateStr = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekStart = weekStartOf(dateStr);
  const isSuper = tierFor(session.role) === 'SuperAdmin';

  // Which staff to include: all template-holders for SuperAdmin, self otherwise
  let staffIds = [session.id];
  let staffList = [{ id: session.id, name: session.name }];
  if (isSuper) {
    const { data: holders, error } = await db
      .from('task_templates')
      .select('staff_id, assignee')
      .eq('active', true);
    if (error) throw error;
    const map = new Map();
    (holders || []).forEach((h) => { if (h.staff_id) map.set(h.staff_id, h.assignee); });
    staffIds = [...map.keys()];
    staffList = staffIds.map((id) => ({ id, name: map.get(id) }));
  }

  // Each person's shift end hour (Manila). Drives when they escalate.
  const shiftMap = new Map();
  if (staffIds.length) {
    const { data: shifts, error: shErr } = await db
      .from('staff')
      .select('id, shift_end_hour')
      .in('id', staffIds);
    if (shErr) throw shErr;
    (shifts || []).forEach((s) => shiftMap.set(s.id, s.shift_end_hour));
  }

  // Materialize today's entries for everyone in scope so numbers are live
  for (const id of staffIds) {
    await materialize(db, id, dateStr);
  }

  const { data: entries, error: entErr } = await db
    .from('task_entries')
    .select('id, staff_id, assignee, frequency, status, period_date, completed_at')
    .in('staff_id', staffIds)
    .or(`and(frequency.eq.Daily,period_date.eq.${dateStr}),and(frequency.eq.Weekly,period_date.eq.${weekStart})`);
  if (entErr) throw entErr;

  const mNow = manilaNow();

  const perStaff = staffList.map((s) => {
    const own = (entries || []).filter((e) => e.staff_id === s.id);
    const lastUpdate = own.map((e) => e.completed_at).filter(Boolean).sort().pop() || null;
    const stats = statsFor(own);
    const dailyOpen = stats.dailyTotal - stats.dailyDone - stats.dailySkipped;
    // This person's own shift end (default 15 = 3PM). REST_DAY (0) = never escalate.
    const shiftEnd = shiftMap.has(s.id) ? shiftMap.get(s.id) : 15;
    let pastShiftEnd = false;
    if (shiftEnd !== REST_DAY) {
      pastShiftEnd = (dateStr < mNow.date) || (dateStr === mNow.date && mNow.hour >= shiftEnd);
    }
    const escalated = pastShiftEnd && dailyOpen > 0;
    return { staffId: s.id, name: s.name, ...stats, lastUpdate, dailyOpen, shiftEndHour: shiftEnd, escalated };
  });

  // Whether any escalation window is active (used for the "all clear" note).
  const anyCutoffPassed = perStaff.some((p) => p.shiftEndHour !== REST_DAY &&
    ((dateStr < mNow.date) || (dateStr === mNow.date && mNow.hour >= p.shiftEndHour)));

  // 7-day daily-completion trend (single-staff requests only)
  let trend = null;
  const trendStaff = url.searchParams.get('staff') || (!isSuper ? session.id : null);
  if (trendStaff) {
    if (trendStaff !== session.id && !isSuper) {
      const err = new Error('Not authorized.');
      err.status = 403;
      throw err;
    }
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dateStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const { data: hist, error: histErr } = await db
      .from('task_entries')
      .select('period_date, status')
      .eq('staff_id', trendStaff)
      .eq('frequency', 'Daily')
      .gte('period_date', days[0])
      .lte('period_date', days[6]);
    if (histErr) throw histErr;
    trend = days.map((d) => {
      const dayEntries = (hist || []).filter((e) => e.period_date === d);
      return { date: d, total: dayEntries.length, done: dayEntries.filter((e) => e.status === 'Done').length };
    });
  }

  return ok({ date: dateStr, weekStart, perStaff, trend, cutoffPassed: anyCutoffPassed });
});
