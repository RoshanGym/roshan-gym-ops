import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';
import { normalizeName } from '../../../../lib/members';

export const dynamic = 'force-dynamic';

// Checks a batch of candidate rows (from an "Upload New Member" POS report)
// against existing members, so the client can prompt "skip or import anyway"
// before committing. Match key: member_no first (most reliable when the
// report has it), falling back to normalized name + branch.
export const POST = withApi(async (req) => {
  requireSession();
  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) return ok({ matches: [] });

  const db = supabaseAdmin();
  const { data: existing, error } = await db
    .from('members')
    .select('id, name, branch, member_no, expiry_date, plan, status');
  if (error) throw error;

  const byMemberNo = new Map();
  const byNameBranch = new Map();
  for (const m of existing) {
    if (m.member_no) byMemberNo.set(m.member_no, m);
    byNameBranch.set(normalizeName(m.name) + '|' + (m.branch || ''), m);
  }

  const matches = [];
  rows.forEach((row, index) => {
    let hit = null;
    if (row.memberNo && byMemberNo.has(row.memberNo)) {
      hit = byMemberNo.get(row.memberNo);
    } else {
      const key = normalizeName(row.name) + '|' + (row.branch || '');
      if (byNameBranch.has(key)) hit = byNameBranch.get(key);
    }
    if (hit) {
      matches.push({
        index,
        existing: { id: hit.id, name: hit.name, branch: hit.branch, memberNo: hit.member_no, expiryDate: hit.expiry_date, plan: hit.plan, status: hit.status },
      });
    }
  });

  return ok({ matches });
});
