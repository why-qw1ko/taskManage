import { database } from '../../../lib/database.mjs';
import { validateData } from '../../../lib/tasks.ts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

function isAllowedRequest(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const allowedOrigins = (process.env.DAYFLOW_ALLOWED_ORIGINS || '')
    .split(',').map((value) => value.trim().replace(/\/$/, ''));
  const allowedAddress = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    allowedOrigins.includes(url.origin);
  return allowedAddress &&
    (!origin || origin === url.origin) &&
    (!site || site === 'same-origin' || site === 'none');
}

export async function GET(request: Request) {
  if (!isAllowedRequest(request)) return new Response('Forbidden', { status: 403 });
  try {
    const row = database().prepare('SELECT revision, payload FROM dayflow_state WHERE id = 1')
      .get() as { revision: number; payload: string } | undefined;
    return Response.json(row ? { revision: row.revision, data: validateData(JSON.parse(row.payload)) } : null, { headers });
  } catch {
    return new Response('Database unavailable', { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  if (!isAllowedRequest(request) || request.headers.get('origin') !== new URL(request.url).origin)
    return new Response('Forbidden', { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return new Response('Invalid content type', { status: 415 });
  let input: { revision?: unknown; data?: unknown };
  let payload: string;
  try {
    const contentLength = Number(request.headers.get('content-length'));
    if (contentLength > 5 * 1024 * 1024) return new Response('Data too large', { status: 413 });
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024)
      return new Response('Data too large', { status: 413 });
    input = JSON.parse(body) as { revision?: unknown; data?: unknown };
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return new Response('Invalid data', { status: 400 });
    if (input.revision !== null && (!Number.isSafeInteger(input.revision) || (input.revision as number) < 1))
      return new Response('Invalid revision', { status: 400 });
    payload = JSON.stringify(validateData(input.data));
  } catch {
    return new Response('Invalid data', { status: 400 });
  }
  try {
    const result = input.revision === null
      ? database().prepare('INSERT INTO dayflow_state (id, revision, payload) VALUES (1, 1, ?) ON CONFLICT(id) DO NOTHING').run(payload)
      : database().prepare('UPDATE dayflow_state SET revision = revision + 1, payload = ? WHERE id = 1 AND revision = ?').run(payload, input.revision as number);
    if (!result.changes) return new Response('Conflict', { status: 409, headers });
    return Response.json({ revision: input.revision === null ? 1 : (input.revision as number) + 1 }, { headers });
  } catch {
    return new Response('Database unavailable', { status: 503, headers });
  }
}
