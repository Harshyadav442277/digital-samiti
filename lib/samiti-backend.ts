import 'server-only';
import { getChatGPTUser } from '../app/chatgpt-auth';

export function usesExpressBackend() {
  return Boolean(process.env.SAMITI_API_URL);
}

export async function forwardToSamitiBackend(req: Request, scheduler = false) {
  const base = process.env.SAMITI_API_URL;
  const secret = process.env.SAMITI_API_SECRET;
  if (!base || !secret) return Response.json({ error: 'Backend configuration is incomplete.' }, { status: 503 });
  const target = new URL(base);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if ((!local && target.protocol !== 'https:') || target.username || target.password) {
    return Response.json({ error: 'Configure an HTTPS backend URL.' }, { status: 503 });
  }
  const incoming = new URL(req.url);
  if (!scheduler && req.method !== 'GET' && req.headers.get('origin') !== incoming.origin) {
    return Response.json({ error: 'Please send requests from Digital Samiti.' }, { status: 403 });
  }
  const headers = new Headers({ authorization: `Bearer ${secret}` });
  // Only identity verified by the app's server may cross the service boundary.
  // Caller-supplied identity headers are deliberately never forwarded.
  if (scheduler) {
    headers.set('x-samiti-cron-authorization', req.headers.get('authorization') ?? '');
  } else {
    const user = await getChatGPTUser();
    if (user) {
      headers.set('x-samiti-user-id', user.userId);
      headers.set('x-samiti-user-name', encodeURIComponent(user.fullName || user.email.split('@')[0]));
    }
    const cookie = req.headers.get('cookie')?.match(/(?:^|;\s*)samiti_demo=[a-f0-9]{64}(?=;|$)/)?.[0]?.replace(/^;\s*/, '');
    if (cookie) headers.set('cookie', cookie);
  }
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const reader = req.body?.getReader();
    if (reader) {
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 12000) {
          await reader.cancel();
          return Response.json({ error: 'Request is too large.' }, { status: 413 });
        }
        chunks.push(chunk.value);
      }
      body = Buffer.concat(chunks).toString('utf8');
      headers.set('content-type', 'application/json');
    }
  }
  target.pathname = scheduler ? '/api/autopay/run' : '/api/samiti';
  target.search = '';
  try {
    const upstream = await fetch(target, {
      method: req.method, headers, body, cache: 'no-store',
      signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    const responseHeaders = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: 'The Samiti backend is unavailable. Please try again.' }, { status: 503 });
  }
}
