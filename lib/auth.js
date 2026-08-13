import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'roshan_session';
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Missing SESSION_SECRET environment variable.');
  return s;
}

// Issue a signed session cookie after a successful login.
export function createSessionCookie(staff) {
  const token = jwt.sign(
    { id: staff.id, name: staff.name, username: staff.username, role: staff.role },
    secret(),
    { expiresIn: `${SESSION_DAYS}d` }
  );
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

// Reads and verifies the session cookie. Returns null if missing/invalid.
// This is the source of truth for "who is doing this" on every request —
// the client cannot spoof this by editing browser state.
export function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch (e) {
    return null;
  }
}

export const SUPER_ADMIN_ROLES = ['Supervisor', 'Owner'];

export function tierFor(role) {
  return SUPER_ADMIN_ROLES.includes(role) ? 'SuperAdmin' : role;
}

// Convenience: throws a Response-friendly error object { status, message }.
export function requireSession() {
  const session = getSession();
  if (!session) {
    const err = new Error('Not signed in.');
    err.status = 401;
    throw err;
  }
  return session;
}

export function requireRole(session, allowedRoles) {
  if (!allowedRoles.includes(session.role)) {
    const err = new Error('Not authorized for this action.');
    err.status = 403;
    throw err;
  }
}
