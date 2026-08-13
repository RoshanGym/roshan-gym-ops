import { handleList } from '../../../lib/trial';
import { requireSession } from '../../../lib/auth';
import { withApi } from '../../../lib/api';

export const GET = withApi(async () => {
  requireSession();
  const r = await handleList();
  return Response.json(r.json, { status: r.status });
});
