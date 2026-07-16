import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession, tierFor } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const session = requireSession();
  const db = supabaseAdmin();
  const tier = tierFor(session.role);

  let requestsQuery = db.from('requests').select('*, attachments(*)').order('created_at', { ascending: false });
  if (tier !== 'SuperAdmin') requestsQuery = requestsQuery.is('deleted_at', null);

  const [requests, tasks, sales, members, products] = await Promise.all([
    requestsQuery,
    db.from('tasks').select('*').order('date', { ascending: false }),
    db.from('sales').select('*').order('date', { ascending: false }),
    db.from('members').select('*').order('expiry_date'),
    db.from('products').select('*').order('item'),
  ]);
  for (const r of [requests, tasks, sales, members, products]) {
    if (r.error) throw r.error;
  }

  let staff = [];
  if (tier === 'SuperAdmin') {
    const { data, error } = await db.from('staff').select('id,name,username,role,active,created_at').order('name');
    if (error) throw error;
    staff = data;
  }

  return ok({
    user: { id: session.id, name: session.name, role: session.role, username: session.username },
    requests: requests.data,
    tasks: tasks.data,
    sales: sales.data,
    members: members.data,
    products: products.data,
    staff,
  });
});
