import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const body = await req.json();

  const { data: tpl, error: getErr } = await db.from('task_templates').select('staff_id').eq('id', params.id).single();
  if (getErr) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }
  if (tpl.staff_id !== session.id && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('You can only change your own tasks.');
    err.status = 403;
    throw err;
  }

  const update = {};
  if (body.title != null) update.title = body.title;
  if (body.section != null) update.section = body.section;
  if (body.category != null) update.category = body.category;
  if (body.frequency != null && ['Daily', 'Weekly'].includes(body.frequency)) update.frequency = body.frequency;
  if (body.sortOrder != null) update.sort_order = body.sortOrder;
  if (body.active != null) update.active = body.active;
  const { data, error } = await db
    .from('task_templates')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) throw error;
  return ok({ template: data });
});
