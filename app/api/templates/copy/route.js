import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession, requireRole, SUPER_ADMIN_ROLES } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

// Copy one staff member's active checklist templates to another staff member.
// Skips any task the target already has (same title + frequency), so it's
// safe to run on someone with an existing checklist and safe to re-run.
export const POST = withApi(async (req) => {
  const session = requireSession();
  requireRole(session, SUPER_ADMIN_ROLES);
  const { fromStaffId, toStaffId } = await req.json();
  if (!fromStaffId || !toStaffId) {
    const err = new Error('Choose who to copy from and who to copy to.');
    err.status = 400;
    throw err;
  }
  if (fromStaffId === toStaffId) {
    const err = new Error('Choose two different people.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  const { data: target, error: tErr } = await db.from('staff').select('id,name').eq('id', toStaffId).single();
  if (tErr) {
    const err = new Error('Target staff member not found.');
    err.status = 404;
    throw err;
  }

  const { data: source, error: sErr } = await db
    .from('task_templates')
    .select('*')
    .eq('staff_id', fromStaffId)
    .eq('active', true)
    .order('frequency')
    .order('sort_order');
  if (sErr) throw sErr;
  if (!source || !source.length) {
    const err = new Error('That person has no active checklist tasks to copy.');
    err.status = 400;
    throw err;
  }

  const { data: existing, error: eErr } = await db
    .from('task_templates')
    .select('title, frequency')
    .eq('staff_id', toStaffId)
    .eq('active', true);
  if (eErr) throw eErr;
  const have = new Set((existing || []).map((t) => (t.frequency + '|' + t.title.trim().toLowerCase())));

  const rows = source
    .filter((t) => !have.has(t.frequency + '|' + t.title.trim().toLowerCase()))
    .map((t) => ({
      staff_id: target.id,
      assignee: target.name,
      title: t.title,
      section: t.section || '',
      frequency: t.frequency,
      category: t.category || '',
      sort_order: t.sort_order || 0,
      active: true,
      seed_tag: 'copied',
    }));

  if (!rows.length) {
    return ok({ copied: 0, skipped: source.length, message: 'Nothing to copy — the target already has all of those tasks.' });
  }

  const { error: insErr } = await db.from('task_templates').insert(rows);
  if (insErr) throw insErr;

  return ok({ copied: rows.length, skipped: source.length - rows.length });
});
