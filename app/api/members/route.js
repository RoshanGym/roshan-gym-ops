import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession } from '../../../lib/auth';
import { newSimpleId } from '../../../lib/ids';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const PLAN_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12, 'Class pack': 0 };
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.from('members').select('*').order('expiry_date');
  if (error) throw error;
  return ok({ members: data });
});

// Creating a member REQUIRES the scanned membership form in the same request
// (multipart form-data). This makes a formless member impossible: if the file
// is missing the request is rejected, and if storage upload fails the member
// row is rolled back.
export const POST = withApi(async (req) => {
  const session = requireSession();
  if (session.role !== 'Admin') {
    const err = new Error('Only Admin accounts add members.');
    err.status = 403;
    throw err;
  }

  const form = await req.formData();
  const get = (k) => {
    const v = form.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };

  const name = get('name');
  const contact = get('contact');
  const plan = get('plan') || 'Monthly';
  const startDate = get('startDate');
  const amount = parseFloat(get('amount')) || 0;
  const branch = get('branch');
  const status = get('status') || 'New';
  const tshirtSize = get('tshirtSize');
  const source = get('source');
  const remarks = get('remarks');
  const file = form.get('file');

  if (!name) {
    const err = new Error('Enter a name for this member.');
    err.status = 400;
    throw err;
  }
  if (!file || typeof file === 'string') {
    const err = new Error('The scanned membership form is required — attach a PNG, JPG, or PDF before saving.');
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('That form file is over 8MB. Scan at a lower resolution or compress it.');
    err.status = 400;
    throw err;
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    const err = new Error('The membership form must be a PNG, JPG, or PDF.');
    err.status = 400;
    throw err;
  }

  const start = startDate || new Date().toISOString().slice(0, 10);
  const months = PLAN_MONTHS[plan] != null ? PLAN_MONTHS[plan] : 1;
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + (months || 1));
  const expiryStr = expiry.toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const id = await newSimpleId('M', 'members');

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `members/${id}/${crypto.randomUUID()}.${ext}`;

  const { data: member, error } = await db
    .from('members')
    .insert({
      id, name, contact, plan, start_date: start, expiry_date: expiryStr, amount,
      branch, tshirt_size: tshirtSize, status, source, remarks,
      form_path: path,
      form_name: file.name,
      form_uploaded_by: session.name,
      form_uploaded_at: new Date().toISOString(),
      created_by: session.name,
      history: [{ date: start, amount, action: status === 'Renew' ? 'Renew' : 'New', newExpiry: expiryStr, by: session.name }],
    })
    .select('*')
    .single();
  if (error) throw error;

  // Upload the form; if storage fails, roll the member back so no member can
  // exist without their form on file.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from('attachments').upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) {
    await db.from('members').delete().eq('id', id);
    const err = new Error('The form upload failed (' + upErr.message + '). The member was NOT saved — try again.');
    err.status = 500;
    throw err;
  }

  return ok({ member });
});
