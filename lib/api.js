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
      return NextResponse.json({ error: e.message || 'Something went wrong.' }, { status });
    }
  };
}

export function ok(data) {
  return NextResponse.json(data);
}
