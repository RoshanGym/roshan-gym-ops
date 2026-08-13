// SERVER-ONLY. Never import this from client code.
// Uses the Supabase service role key, which bypasses Row Level Security.
// All access control happens in our own API routes (see lib/auth.js),
// not in Supabase itself, since the browser never talks to Supabase directly.
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}
