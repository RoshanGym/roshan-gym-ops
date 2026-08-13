import { NextResponse } from 'next/server';

// Wraps a route handler so thrown { status, message } errors (from
// requireSession/requireRole) turn into proper JSON error responses,
// and unexpected errors don't leak internals to the client.
export function withApi(handler) {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      const body = { error: e.message || 'Something went wrong.' };
      if (e.details) body.details = e.details;
      return NextResponse.json(body, { status });
    }
  };
}

export function ok(data) {
  return NextResponse.json(data);
}
