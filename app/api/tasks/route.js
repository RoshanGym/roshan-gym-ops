import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('tasks').select('*').order('date', { ascending: false });
  if (error) throw error;
  return ok({ tasks: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
    const err = new Error('Only Admin accounts log tasks.');
    err.status = 403;
    throw err;
  }
  const { title, assignee, date, notes } = await req.json();
  if (!title || !assignee) {
    const err = new Error('Add a task description and who it is assigned to.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const id = await newSimpleId('T', 'tasks');
  const { data, error } = await db
    .from('tasks')
    .insert({ id, title, assignee, date: date || new Date().toISOString().slice(0, 10), notes, status: 'To do', created_by: session.name })
    .select('*')
    .single();
  if (error) throw error;
  return ok({ task: data });
});
