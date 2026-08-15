import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../../lib/auth';
import { withApi, ok } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

const FIELD_MAP = {
  tshirtSize: 'tshirt_size',
  source: 'source',
  tshirtReleasedDate: 'tshirt_released_date',
  keyfobReleasedDate: 'keyfob_released_date',
};

// Fills in the operational details that don't come from the POS upload:
// t-shirt size, source, and the t-shirt/keyfob released dates. These are
// set per member from the Membership Tracker list once known (t-shirt size
// and source once decided, released dates once the item is actually handed
// over) — deliberately not required at upload time.
export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  if (session.role !== 'Admin' && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('Only Admin or Super Admin accounts update this.');
    err.status = 403;
    throw err;
  }

  const body = await req.json();
  const update = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) update[column] = body[key] || (column.endsWith('_date') ? null : '');
  }
  if (!Object.keys(update).length) {
    const err = new Error('Nothing to update.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  const { data: member, error } = await db
    .from('members')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) throw error;
  if (!member) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }
  return ok({ member });
});
