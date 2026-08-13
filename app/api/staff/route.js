import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, requireRole, SUPER_ADMIN_ROLES } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('staff')
    .select('id,name,username,role,active,created_at,shift_end_hour')
    .order('name');
  if (error) throw error;
  return ok({ staff: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const { name, username, password, role } = await req.json();
  if (!name || !username || !password || !role) {
    const err = new Error('Name, username, password, and role are all required.');
    err.status = 400;
    throw err;
  }
  if (password.length < 4) {
    const err = new Error('Password must be at least 4 characters.');
    err.status = 400;
    throw err;
  }
  if (!['Admin', 'Supervisor', 'Owner', 'Coach'].includes(role)) {
    const err = new Error('Invalid role.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await db
    .from('staff')
    .insert({ name, username: username.trim().toLowerCase(), password_hash, role, active: true })
    .select('id,name,username,role,active,created_at,shift_end_hour')
    .single();
  if (error) {
    if (error.code === '23505') {
      const err = new Error('That username is already taken.');
      err.status = 409;
      throw err;
    }
    throw error;
  }
  return ok({ staff: data });
});
