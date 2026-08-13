import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  if (!['Admin', 'Owner', 'Supervisor'].includes(session.role)) {
    const err = new Error('Not authorized.');
    err.status = 403;
    throw err;
  }
  const body = await req.json();
  const db = supabaseAdmin();
  const update = {};
  if (body.cost != null) update.cost = body.cost;
  if (body.active != null) update.active = body.active;
  const { data, error } = await db.from('products').update(update).eq('id', params.id).select('*').single();
  if (error) throw error;
  return ok({ product: data });
});
