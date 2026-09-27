const NO_STORE = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const operations = new Map([
  ['/api/g1/preview', 'preview_resume'],
  ['/api/g1/confirm', 'save_student_setup'],
  ['/api/g1/context', 'retrieve_student_context'],
  ['/api/g1/handoff', 'request_student_clarification'],
]);

function json(value, status = 200) {
  return Response.json(value, { status, headers: NO_STORE });
}

function authenticatedEmail(request) {
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signEnvelope(secret, envelope) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const encoded = new TextEncoder().encode(JSON.stringify(envelope));
  return { encoded: base64url(encoded), signature: base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoded))) };
}

async function proxy(request, env, email, operation) {
  if (!env.G1_GATEWAY_SECRET || !env.SUPABASE_G1_URL)
    return json({ ok: false, code: 'NOT_CONNECTED', message: 'Setup storage is not connected yet.' }, 503);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, code: 'CROSS_ORIGIN_DENIED' }, 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    return json({ ok: false, code: 'JSON_REQUIRED' }, 415);
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > 7_500_000) return json({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);
  const envelope = {
    operation,
    identity_email: email,
    request_id: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    expires_at_ms: Date.now() + 30_000,
    body_sha256_hex: bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', body))),
  };
  const signed = await signEnvelope(env.G1_GATEWAY_SECRET, envelope);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), operation === 'request_student_clarification' ? 5_000 : 30_000);
  try {
    const response = await fetch(env.SUPABASE_G1_URL, {
      method: 'POST', body, signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-career-envelope': signed.encoded, 'x-career-signature': signed.signature },
    });
    const data = await response.json();
    return json(data, response.status);
  } catch {
    return json({ ok: false, code: 'GATEWAY_UNAVAILABLE', message: 'Setup could not be completed. No search was started.' }, 503);
  } finally { clearTimeout(timeout); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/session') {
      const email = authenticatedEmail(request);
      if (!email) return json({ authenticated: false, code: 'SIGN_IN_REQUIRED' }, 401);
      return json({ authenticated: true, display_name: request.headers.get('oai-authenticated-user-full-name')?.trim() || null });
    }
    if (url.pathname === '/api/status') {
      const email = authenticatedEmail(request);
      if (!email) return json({ authenticated: false, connected: false, code: 'SIGN_IN_REQUIRED' }, 401);
      return json({ authenticated: true, connected: Boolean(env.G1_GATEWAY_SECRET && env.SUPABASE_G1_URL),
        data_mode: env.G1_GATEWAY_SECRET && env.SUPABASE_G1_URL ? 'live' : 'not_connected' });
    }
    if (operations.has(url.pathname)) {
      if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
      const email = authenticatedEmail(request);
      if (!email) return json({ ok: false, code: 'SIGN_IN_REQUIRED' }, 401);
      return proxy(request, env, email, operations.get(url.pathname));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    return env.ASSETS.fetch(request);
  },
};
