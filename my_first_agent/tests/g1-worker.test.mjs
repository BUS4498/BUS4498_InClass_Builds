import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../app/worker/index.mjs';

const origin = 'https://career-opportunity-prep-agent.example';
const env = { ASSETS: { fetch: async () => new Response('asset') } };

test('signed-out session and setup requests are denied', async () => {
  const session = await worker.fetch(new Request(`${origin}/api/session`), env);
  assert.equal(session.status, 401);
  const setup = await worker.fetch(new Request(`${origin}/api/g1/context`, { method: 'POST' }), env);
  assert.equal(setup.status, 401);
});

test('configured routes still refuse cross-origin writes and unconfigured storage reports incomplete', async () => {
  const headers = { 'oai-authenticated-user-email': 'maya@example.com', 'content-type': 'application/json' };
  const offline = await worker.fetch(new Request(`${origin}/api/g1/context`, { method: 'POST', headers, body: '{}' }), env);
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).code, 'NOT_CONNECTED');
  const crossOrigin = await worker.fetch(new Request(`${origin}/api/g1/context`, { method: 'POST', headers: { ...headers, origin: 'https://other.example' }, body: '{}' }), { ...env, G1_GATEWAY_SECRET: 'synthetic-test-only', SUPABASE_G1_URL: 'https://project.example/function' });
  assert.equal(crossOrigin.status, 403);
});

test('the signed gateway owner comes from the authenticated header, not client JSON', async () => {
  const oldFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (_url, options) => {
    forwarded = options;
    return Response.json({ ok: true });
  };
  try {
    const request = new Request(`${origin}/api/g1/context`, {
      method: 'POST',
      headers: { 'oai-authenticated-user-email': '  MAYA@example.com ', 'content-type': 'application/json', origin },
      body: JSON.stringify({ owner_id: 'forged-other-student' }),
    });
    const response = await worker.fetch(request, { ...env, G1_GATEWAY_SECRET: 'synthetic-test-only', SUPABASE_G1_URL: 'https://project.example/function' });
    assert.equal(response.status, 200);
    const encoded = forwarded.headers['x-career-envelope'].replace(/-/g, '+').replace(/_/g, '/');
    const envelope = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    assert.equal(envelope.identity_email, 'maya@example.com');
    assert.equal('owner_id' in envelope, false);
    assert.notEqual(envelope.body_sha256_hex, '');
  } finally { globalThis.fetch = oldFetch; }
});
