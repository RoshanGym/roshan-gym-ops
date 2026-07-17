import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req) => {
  const session = requireSession();
  const db = supabaseAdmin();
  let query = db.from('task_templates').select('*').order('staff_id').order('frequency').order('sort_order');
  if (tierFor(session.role) !== 'SuperAdmin') query = query.eq('staff_id', session.id);
  const { data, error } = await query;
  if (error) throw error;
  return ok({ templates: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  const body = await req.json();
  const { staffId, title, section, frequency, category, sortOrder } = body;
  if (!title || !['Daily', 'Weekly'].includes(frequency)) {
    const err = new Error('Task title and frequency (Daily/Weekly) are required.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();

  // A user may add tasks to their own checklist. Only Super Admins may add
  // tasks to someone else's.
  const targetId = staffId || session.id;
  if (targetId !== session.id && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('You can only add tasks to your own checklist.');
    err.status = 403;
    throw err;
  }

  const { data: person, error: pErr } = await db.from('staff').select('id,name').eq('id', targetId).single();
  if (pErr) {
    const err = new Error('Staff member not found.');
    err.status = 404;
    throw err;
  }
  const { data, error } = await db
    .from('task_templates')
    .insert({
      staff_id: person.id,
      assignee: person.name,
      title,
      section: section || '',
      frequency,
      category: category || '',
      sort_order: sortOrder || 999,
      active: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return ok({ template: data });
});
