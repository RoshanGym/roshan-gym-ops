import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../../lib/auth';
import { withApi, ok } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();

  const { data: entry, error: getErr } = await db.from('task_entries').select('*').eq('id', params.id).single();
  if (getErr) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }
  if (entry.staff_id !== session.id && tierFor(session.role) !== 'SuperAdmin') {
    const err = new Error('You can only attach proof to your own tasks.');
    err.status = 403;
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
    const err = new Error('That file is over 4MB. Attach a smaller image.');
    err.status = 400;
    throw err;
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `tasks/${params.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from('attachments').upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { error: insErr } = await db.from('task_files').insert({
    task_entry_id: params.id,
    name: file.name,
    mime: file.type,
    storage_path: path,
    uploaded_by: session.name,
  });
  if (insErr) throw insErr;

  const { data: updated, error } = await db
    .from('task_entries')
    .select('*, task_files(*)')
    .eq('id', params.id)
    .single();
  if (error) throw error;
  return ok({ entry: updated });
});

export const GET = withApi(async (req, { params }) => {
  requireSession();
  const db = supabaseAdmin();
  const url = new URL(req.url);
  const fileId = url.searchParams.get('file');
  const { data: f, error } = await db
    .from('task_files')
    .select('*')
    .eq('id', fileId)
    .eq('task_entry_id', params.id)
    .single();
  if (error) {
    const err = new Error('File not found.');
    err.status = 404;
    throw err;
  }
  const { data: signed, error: signErr } = await db.storage
    .from('attachments')
    .createSignedUrl(f.storage_path, 60);
  if (signErr) throw signErr;
  return Response.redirect(signed.signedUrl);
});
