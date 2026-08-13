import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('sales_targets').select('*').order('month');
  if (error) throw error;
  return ok({ targets: data || [] });
});
