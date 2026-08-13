import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();
  const body = await req.json();

  const { data: entry, error: getErr } = await db.from('task_entries').select('*').eq('id', params.id).single();
  if (getErr) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }
  if (entry.staff_id !== session.id && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('You can only update your own tasks.');
    err.status = 403;
    throw err;
  }

  const update = {};
  if (body.status != null) {
    if (!['Not Started', 'In Progress', 'Done', 'Skipped'].includes(body.status)) {
      const err = new Error('Invalid status.');
      err.status = 400;
      throw err;
    }
    update.status = body.status;
    if (body.status === 'Done') {
      update.completed_at = new Date().toISOString();
      update.completed_by = session.name;
    } else {
      update.completed_at = null;
      update.completed_by = null;
    }
  }
  if (body.remarks != null) update.remarks = String(body.remarks).slice(0, 1000);

  const { data, error } = await db
    .from('task_entries')
    .update(update)
    .eq('id', params.id)
    .select('*, task_files(*)')
    .single();
  if (error) throw error;
  return ok({ entry: data });
});
