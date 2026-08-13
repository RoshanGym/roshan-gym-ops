import { handleAction } from '../../../../lib/trial';
import { requireSession } from '../../../../lib/auth';
import { withApi } from '../../../../lib/api';

export const POST = withApi(async (req, { params }) => {
  requireSession();
  const { id } = await params;
  const r = await handleAction(id, await req.json());
  return Response.json(r.json, { status: r.status });
});
