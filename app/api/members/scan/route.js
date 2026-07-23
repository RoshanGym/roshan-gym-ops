import { requireSession } from '../../../../lib/auth';
import { withApi, ok } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;

// Reads a scanned Roshan membership form with AI vision and returns the
// member fields as structured data. Requires ANTHROPIC_API_KEY in the
// environment; if it's not set, returns { available: false } so the client
// can fall back to basic on-device OCR.
export const POST = withApi(async (req) => {
  requireSession();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return ok({ available: false });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    const err = new Error('No file provided.');
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('That file is over 8MB.');
    err.status = 400;
    throw err;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const b64 = bytes.toString('base64');
  const isPdf = (file.type || '') === 'application/pdf';

  const mediaBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 } };

  const prompt = `This is a scanned Roshan Gym membership agreement form, filled in by hand.
Extract the member's details and respond with ONLY a JSON object (no markdown fences, no commentary) with these keys:
{
  "firstName": string or null,
  "lastName": string or null,
  "contactNumber": string or null,
  "email": string or null,
  "address": string or null,
  "startDate": "YYYY-MM-DD" or null (from the Start Date box, if legible),
  "branch": "Manila" or "Malabon" or null (printed under the logo),
  "source": one of "Facebook", "Online Inquiries", "Walk-in", "Referral", "Other" or null
           (from the "Where did you learn about us?" checkboxes:
            Facebook/Instagram/TikTok -> "Facebook";
            Google / Online Search -> "Online Inquiries";
            Walk in -> "Walk-in";
            Recommended by a friend/relative -> "Referral";
            Event / Community Activity or OTHERS -> "Other"),
  "gender": "M" or "F" or null
}
Read handwriting carefully. If a value is illegible or blank, use null — do not guess.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: [mediaBlock, { type: 'text', text: prompt }] },
      ],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error('The AI reader could not process the form (' + resp.status + '). ' + detail.slice(0, 200));
    err.status = 502;
    throw err;
  }

  const data = await resp.json();
  const text = (data.content || [])
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  let fields = {};
  try {
    fields = JSON.parse(text);
  } catch (e) {
    const err = new Error('The AI reader returned an unexpected response. Try again, or fill the fields manually.');
    err.status = 502;
    throw err;
  }

  return ok({ available: true, fields });
});
