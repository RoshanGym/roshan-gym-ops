import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, requireRole, SUPER_ADMIN_ROLES } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const PATCH = withApi(async (req, { params }) => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const { action, password } = await req.json();
  const db = supabaseAdmin();

  if (action === 'reset-password') {
    if (!password || password.length < 4) {
      const err = new Error('Password must be at least 4 characters.');
      err.status = 400;
      throw err;
    }
    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await db.from('staff').update({ password_hash }).eq('id', params.id);
    if (error) throw error;
    return ok({ success: true });
  }

  if (action === 'toggle-active') {
    const { data: person, error: getErr } = await db.from('staff').select('active').eq('id', params.id).single();
    if (getErr) throw getErr;
    const { error } = await db.from('staff').update({ active: !person.active }).eq('id', params.id);
    if (error) throw error;
    return ok({ success: true, active: !person.active });
  }

  const err = new Error('Unknown action.');
  err.status = 400;
  throw err;
});
