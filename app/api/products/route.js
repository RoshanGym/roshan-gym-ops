import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('products').select('*').order('item');
  if (error) throw error;
  return ok({ products: data });
});

export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin' && session.role !== 'Owner' && session.role !== 'Supervisor') {
    const err = new Error('Not authorized.');
    err.status = 403;
    throw err;
  }
  const { item, cost, supplierKeys } = await req.json();
  if (!item || !cost || cost <= 0) {
    const err = new Error('Enter an item name and a valid cost.');
    err.status = 400;
    throw err;
  }
  const db = supabaseAdmin();
  const id = await newSimpleId('P', 'products');
  const { data, error } = await db
    .from('products')
    .insert({ id, item, cost, supplier_keys: supplierKeys || [], active: true })
    .select('*')
    .single();
  if (error) throw error;
  return ok({ product: data });
});
