// Shared helpers for the daily/weekly checklist system.

export function weekStartOf(dateStr) {
  // Monday-of-week for a YYYY-MM-DD date string
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Ensure every active template for this staff member has an entry for the
// given period (the date itself for Daily, Monday-of-week for Weekly).
// Upsert on the (template_id, period_date) unique constraint means two
// devices loading at once can't create duplicates.
export async function materialize(db, staffId, dateStr) {
  const weekStart = weekStartOf(dateStr);
  const { data: templates, error } = await db
    .from('task_templates')
    .select('*')
    .eq('staff_id', staffId)
    .eq('active', true);
  if (error) throw error;
  if (!templates || !templates.length) return;

  const rows = templates.map((t) => ({
    template_id: t.id,
    staff_id: t.staff_id,
    assignee: t.assignee,
    title: t.title,
    section: t.section || '',
    frequency: t.frequency,
    category: t.category || '',
    sort_order: t.sort_order || 0,
    period_date: t.frequency === 'Daily' ? dateStr : weekStart,
  }));
  const { error: upErr } = await db
    .from('task_entries')
    .upsert(rows, { onConflict: 'template_id,period_date', ignoreDuplicates: true });
  if (upErr) throw upErr;
}
