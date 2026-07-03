import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
    const err = new Error('Only Admin accounts update tasks.');
    err.status = 403;
    throw err;
  }
  const { status } = await req.json();
  if (!['To do', 'In progress', 'Done'].includes(status)) {
    const err = new Error('Invalid status.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const update = { status };
  if (status === 'Done') {
    update.completed_by = session.name;
    update.completed_at = new Date().toISOString();
  } else {
    update.completed_by = null;
    update.completed_at = null;
  }
  const { data, error } = await db.from('tasks').update(update).eq('id', params.id).select('*').single();
  if (error) throw error;
  return ok({ task: data });
});
