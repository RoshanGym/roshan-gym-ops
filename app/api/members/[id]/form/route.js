import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireSession } from '../../../../../lib/auth';
import { withApi, ok } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // scanned forms can be larger than receipts
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

// Upload (or replace) the scanned membership form for a member.
export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();

  const { data: member, error: getErr } = await db.from('members').select('id, form_path, history').eq('id', params.id).single();
  if (getErr) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    const err = new Error('No file provided.');
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('That file is over 8MB. Scan at a lower resolution or compress it.');
    err.status = 400;
    throw err;
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    const err = new Error('Upload a PNG, JPG, or PDF of the membership form.');
    err.status = 400;
    throw err;
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `members/${params.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from('attachments').upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) throw upErr;

  // If replacing an older form, clean the old file (best-effort).
  if (member.form_path) {
    await db.storage.from('attachments').remove([member.form_path]);
  }

  const history = Array.isArray(member.history) ? member.history : [];
  history.push({
    date: new Date().toISOString().slice(0, 10),
    action: member.form_path ? 'Form replaced' : 'Form uploaded',
    by: session.name,
  });

  const { data, error } = await db
    .from('members')
    .update({
      form_path: path,
      form_name: file.name,
      form_uploaded_by: session.name,
      form_uploaded_at: new Date().toISOString(),
      history,
    })
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) throw error;
  return ok({ member: data });
});

// View the membership form: redirects to a short-lived signed URL.
export const GET = withApi(async (req, { params }) => {
  requireSession();
  const db = supabaseAdmin();
  const { data: member, error } = await db.from('members').select('form_path').eq('id', params.id).single();
  if (error || !member.form_path) {
    const err = new Error('No membership form on file for this member.');
    err.status = 404;
    throw err;
  }
  const { data: signed, error: signErr } = await db.storage
    .from('attachments')
    .createSignedUrl(member.form_path, 60);
  if (signErr) throw signErr;
  return Response.redirect(signed.signedUrl);
});
