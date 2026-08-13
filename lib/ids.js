import { supabaseAdmin } from './supabase';

const BRANCH_PREFIX = { Manila: 'MNL', Malabon: 'MBN' };

// Atomically increments a named counter in Postgres and returns the new value.
// Using a DB-side RPC (see supabase/schema.sql: next_seq) instead of a
// client-tracked counter avoids two people creating the same ID at once.
export async function nextSeq(counterName) {
  const { data, error } = await supabaseAdmin().rpc('next_seq', { counter_name: counterName });
  if (error) throw error;
  return data;
}

export async function newRequestId(type, branch) {
  const year = new Date().getFullYear();
  if (type === 'PO') {
    const n = await nextSeq('po_' + (branch || 'other'));
    const prefix = BRANCH_PREFIX[branch] || 'PO';
    return `${prefix}${year}${String(n).padStart(3, '0')}`;
  }
  const n = await nextSeq('pettycash');
  return `PC-${year}-${String(n).padStart(4, '0')}`;
}

export async function newSimpleId(prefix, counterName) {
  const n = await nextSeq(counterName);
  return `${prefix}-${n}`;
}
