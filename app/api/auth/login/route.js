import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createSessionCookie } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const POST = withApi(async (req) => {
  const { username, password } = await req.json();
  if (!username || !password) {
    const err = new Error('Enter your username and password.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const { data: person, error } = await db
    .from('staff')
    .select('*')
    .ilike('username', username.trim())
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  if (!person) {
    const err = new Error('Incorrect username or password.');
    err.status = 401;
    throw err;
  }
  const match = await bcrypt.compare(password, person.password_hash);
  if (!match) {
    const err = new Error('Incorrect username or password.');
    err.status = 401;
    throw err;
  }
  createSessionCookie(person);
  return ok({ user: { id: person.id, name: person.name, role: person.role, username: person.username } });
});
