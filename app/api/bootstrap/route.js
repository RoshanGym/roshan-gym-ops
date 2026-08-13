import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

// Fetch every row, paging past Supabase/PostgREST's 1000-row-per-request cap.
// makeQuery must return a fresh query builder each call so .range() can be applied per page.
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
  const session = requireSession();
  const db = supabaseAdmin();
  const tier = tierFor(session.role);

  const makeRequestsQuery = () => {
    let q = db.from('requests').select('*, attachments(*)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
    if (tier !== 'SuperAdmin') {
      // Admins see only their own requests; Super Admins see everything.
      q = q.is('deleted_at', null).eq('created_by_id', session.id);
    }
    return q;
  };

  const [requests, tasks, sales, members, products] = await Promise.all([
    fetchAll(makeRequestsQuery),
    fetchAll(() => db.from('tasks').select('*').order('date', { ascending: false }).order('id', { ascending: true })),
    fetchAll(() => db.from('sales').select('*').order('date', { ascending: false }).order('id', { ascending: true })),
    fetchAll(() => db.from('members').select('*').order('expiry_date').order('id', { ascending: true })),
    fetchAll(() => db.from('products').select('*').order('item').order('id', { ascending: true })),
  ]);

  let staff = [];
  if (tier === 'SuperAdmin') {
    const { data, error } = await db.from('staff')
      .select('id,name,username,role,active,created_at,shift_end_hour').order('name');
    if (error) throw error;
    staff = data;
  }

  return ok({
    user: { id: session.id, name: session.name, role: session.role, username: session.username },
    requests,
    tasks,
    sales,
    members,
    products,
    staff,
  });
});
