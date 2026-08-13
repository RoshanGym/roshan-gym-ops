import { handleIntake } from '../../../lib/trial';

export async function POST(req) {
  const r = await handleIntake(await req.json());
  return Response.json(r.json, { status: r.status });
}
