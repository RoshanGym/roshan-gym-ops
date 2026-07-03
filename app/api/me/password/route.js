import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const POST = withApi(async (req) => {
  const session = requireSession();
  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 4) {
    const err = new Error('New password must be at least 4 characters.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const { data: person, error } = await db.from('staff').select('*').eq('id', session.id).single();
  if (error) throw error;
  const match = await bcrypt.compare(currentPassword || '', person.password_hash);
  if (!match) {
    const err = new Error('Current password is incorrect.');
    err.status = 400;
    throw err;
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error: upErr } = await db.from('staff').update({ password_hash }).eq('id', session.id);
  if (upErr) throw upErr;
  return ok({ success: true });
});
