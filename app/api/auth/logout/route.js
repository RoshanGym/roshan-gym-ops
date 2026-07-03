import { clearSessionCookie } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const POST = withApi(async () => {
  clearSessionCookie();
  return ok({ success: true });
});
