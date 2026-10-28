import { tierFor } from './auth';

// Mirrors the client's canEditSales(): Super Admins only, minus the view-only
// accounts (Ela). Enforced here so hiding buttons in the UI isn't the only guard.
const VIEW_ONLY_USERNAMES = ['ela'];

export function requireSalesEditor(session) {
  const un = String(session.username || session.name || '').trim().toLowerCase();
  if (tierFor(session.role) !== 'SuperAdmin' || VIEW_ONLY_USERNAMES.includes(un)) {
    const err = new Error('Only Super Admin accounts with edit access can change sales entries.');
    err.status = 403;
    throw err;
  }
}
