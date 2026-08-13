import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

// Update an ad-hoc task: either move its status along, or edit its details
// (title, owners, dates, notes). Any signed-in staff member can do both.
export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  const body = await req.json();
  const db = supabaseAdmin();
  const update = {};

  if (body.status != null) {
    if (!['To do', 'In progress', 'Done'].includes(body.status)) {
      const err = new Error('Invalid status.');
      err.status = 400;
      throw err;
    }
    update.status = body.status;
    if (body.status === 'Done') {
      update.completed_by = session.name;
      update.completed_at = new Date().toISOString();
    } else {
      update.completed_by = null;
      update.completed_at = null;
    }
  }

  // Editable details
  if (body.title != null) {
    const t = String(body.title).trim();
    if (!t) {
      const err = new Error('The task description cannot be empty.');
      err.status = 400;
      throw err;
    }
    update.title = t;
  }
  if (body.assignee != null) {
    const a = String(body.assignee).trim();
    if (!a) {
      const err = new Error('A task needs at least one owner.');
      err.status = 400;
      throw err;
    }
    update.assignee = a;
  }
  if (body.date != null) update.date = body.date;
  if (body.dueDate !== undefined) update.due_date = body.dueDate || null;
  if (body.notes != null) update.notes = String(body.notes).trim();

  if (!Object.keys(update).length) {
    const err = new Error('Nothing to update.');
    err.status = 400;
    throw err;
  }

  if (update.date && update.due_date && update.due_date < update.date) {
    const err = new Error('The due date cannot be before the start date.');
    err.status = 400;
    throw err;
  }

  const { data, error } = await db.from('tasks').update(update).eq('id', params.id).select('*').single();
  if (error) throw error;
  return ok({ task: data });
});

// Delete an ad-hoc task.
export const DELETE = withApi(async (req, { params }) => {
  requireSession();
  const db = supabaseAdmin();
  const { error } = await db.from('tasks').delete().eq('id', params.id);
  if (error) throw error;
  return ok({ success: true, id: params.id });
});
