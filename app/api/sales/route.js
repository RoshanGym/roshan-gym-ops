import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

// Fetch every row, paging past Supabase/PostgREST's 1000-row-per-request cap.
async function fetchAll(makeQuery) {
  const pageSize = 1000;
  let all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break; // last page reached
  }
  return all;
}

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const sales = await fetchAll(() =>
    db.from('sales').select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: true })
  );
  return ok({ sales });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts log sales.');
    err.status = 403;
    throw err;
  }
  const { date, category, amount, method, description } = await req.json();
  if (!amount || amount <= 0) {
    const err = new Error('Enter a valid amount.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const id = await newSimpleId('S', 'sales');
  const { data, error } = await db
    .from('sales')
    .insert({ id, date: date || new Date().toISOString().slice(0, 10), category, amount, method, description, entered_by: session.name })
    .select('*')
    .single();
  if (error) throw error;
  return ok({ sale: data });
});
