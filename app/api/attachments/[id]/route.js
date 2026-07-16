import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireSession } from '../../../../lib/auth';
import { withApi } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req, { params }) => {
  requireSession();
  const db = supabaseAdmin();
  const { data: att, error } = await db.from('attachments').select('*').eq('id', params.id).single();
  if (error) {
    const err = new Error('File not found.');
    err.status = 404;
    throw err;
  }
  const { data: signed, error: signErr } = await db.storage
    .from('attachments')
    .createSignedUrl(att.storage_path, 60);
  if (signErr) throw signErr;
  return NextResponse.redirect(signed.signedUrl);
});
