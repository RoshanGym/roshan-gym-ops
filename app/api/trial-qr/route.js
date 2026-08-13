import { supabaseAdmin } from '../../../lib/supabase';
import { requireSession } from '../../../lib/auth';
import { withApi, ok } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const BUCKET = 'attachments';
const PREFIX = 'trial';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };

export const GET = withApi(async () => {
  requireSession();
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(BUCKET).list(PREFIX);
  if (error) throw error;
  const file = (data || [])[0];
  return ok({ exists: !!file, path: file ? `${PREFIX}/${file.name}` : null, updatedAt: file ? file.updated_at : null });
});

// Uploads (and replaces) the single day-pass QR code image used for every
// trial-booking day-pass email. Only one is kept at a time — any previous
// file under trial/ is removed before the new one is stored.
export const POST = withApi(async (req) => {
  requireSession();
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    const err = new Error('Choose a PNG or JPG image to upload.');
    err.status = 400;
    throw err;
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    const err = new Error('The QR code must be a PNG or JPG image.');
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('That image is over 2MB — use a smaller file.');
    err.status = 400;
    throw err;
  }

  const db = supabaseAdmin();
  const { data: existing } = await db.storage.from(BUCKET).list(PREFIX);
  if (existing && existing.length) {
    await db.storage.from(BUCKET).remove(existing.map((f) => `${PREFIX}/${f.name}`));
  }

  const path = `${PREFIX}/daypass-qr.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;

  return ok({ ok: true, path, updatedAt: new Date().toISOString() });
});
