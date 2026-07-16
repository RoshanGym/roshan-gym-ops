import { getSession } from '../../../../lib/auth';
import { ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session) return ok({ user: null });
  return ok({ user: { id: session.id, name: session.name, role: session.role, username: session.username } });
}
