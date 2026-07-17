import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireSession, tierFor } from '../../../../../lib/auth';
import { withApi, ok } from '../../../../../lib/api';

const MAX_BYTES = 4 * 1024 * 1024;

export const POST = withApi(async (req, { params }) => {
  const session = requireSession();
  const db = supabaseAdmin();

  const form = await req.formData();
  const file = form.get('file');
  const label = (form.get('label') || 'Attachment').toString();
  if (!file || typeof file === 'string') {
    const err = new Error('No file provided.');
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('That file is over 4MB. Attach a smaller image or PDF.');
    err.status = 400;
    throw err;
  }

  const { data: reqRow, error: reqErr } = await db.from('requests').select('id, history, created_by_id').eq('id', params.id).single();
  if (reqErr) {
    const err = new Error('Request not found.');
    err.status = 404;
    throw err;
  }
  if (tierFor(session.role) !== 'SuperAdmin' && reqRow.created_by_id && reqRow.created_by_id !== session.id) {
    const err = new Error('You can only attach files to your own requests.');
    err.status = 403;
    throw err;
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${params.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await db.storage.from('attachments').upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: att, error: attErr } = await db
    .from('attachments')
    .insert({
      request_id: params.id,
      name: file.name,
      mime: file.type,
      label,
      storage_path: path,
      uploaded_by: session.name,
    })
    .select('*')
    .single();
  if (attErr) throw attErr;

  const history = Array.isArray(reqRow.history) ? reqRow.history : [];
  history.push({ at: new Date().toISOString(), text: `Attached file: ${label}`, by: session.name, role: session.role });
  await db.from('requests').update({ history }).eq('id', params.id);

  const { data: updated, error: getErr } = await db.from('requests').select('*, attachments(*)').eq('id', params.id).single();
  if (getErr) throw getErr;
  return ok({ request: updated, attachment: att });
});
