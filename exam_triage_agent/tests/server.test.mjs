import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../app/server.mjs';

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'exam-triage-test-'));
  const server = makeServer({ dataDir: join(root, 'data'), ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ask = async (path, body) => {
    const res = await fetch(`${base}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  const close = async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); };
  return { root, ask, close, base };
}
const futureDate = () => {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const draft = () => ({ exam: { name: 'FICTIONAL: Quiz', date: futureDate(), format: 'written explanation', availableMinutes: 30 },
  topics: [{ name: 'FICTIONAL: Topic', importance: 'must know', confidence: 1 }] });

test('save/readback, invalid edit, stale tab, log, reopen, and confirmed clear', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.ask('/api/state')).data.snapshot, null);
    const saved = await f.ask('/api/context', { expectedRevision: 0, draft: draft() });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.snapshot.revision, 1);
    assert.equal(saved.data.sprint.method, 'teach back');
    assert.equal((await f.ask('/api/state')).data.snapshot.revision, 1);
    const file = join(f.root, 'data', 'exam-triage.json');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).revision, 1);
    const invalid = await f.ask('/api/context', { expectedRevision: 1, draft: { ...draft(), exam: { ...draft().exam, name: '' } } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.error.field, 'exam name');
    assert.equal((await f.ask('/api/state')).data.snapshot.revision, 1);
    const id = saved.data.snapshot.topics[0].id;
    const done = await f.ask('/api/done', { expectedRevision: 1, topicId: id, done: true });
    assert.equal(done.data.sprint, null);
    assert.equal(done.data.top.length, 0);
    const stale = await f.ask('/api/log', { expectedRevision: 1, entry: { topicId: id, minutes: 10, confidence: 2 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.error.code, 'STALE_VERSION');
    const reopened = await f.ask('/api/done', { expectedRevision: 2, topicId: id, done: false });
    assert.equal(reopened.data.top.length, 1);
    const logged = await f.ask('/api/log', { expectedRevision: 3, entry: { topicId: id, minutes: 0, confidence: 1, noStudy: true } });
    assert.equal(logged.data.snapshot.topics[0].lastStudiedAt, null);
    const denied = await f.ask('/api/clear', { expectedRevision: 4, confirm: 'yes' });
    assert.equal(denied.status, 400);
    assert.equal((await f.ask('/api/state')).data.snapshot.revision, 4);
    const cleared = await f.ask('/api/clear', { expectedRevision: 4, confirm: 'CLEAR MY EXAM DATA' });
    assert.equal(cleared.status, 200);
    assert.equal((await f.ask('/api/state')).data.snapshot, null);
    await assert.rejects(stat(file), { code: 'ENOENT' });
  } finally { await f.close(); }
});

test('storage failure does not claim a save', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, 'data'), 'blocks directory creation');
    const result = await f.ask('/api/context', { expectedRevision: 0, draft: draft() });
    assert.equal(result.status, 500);
    assert.equal(result.data.error.code, 'STORAGE_WRITE_FAILED');
  } finally { await f.close(); }
});

test('a foreign browser page cannot trigger a model comparison', async () => {
  let calls = 0;
  const f = await fixture({ suggestMethod: async () => { calls++; throw new Error('should not run'); } });
  try {
    await f.ask('/api/context', { expectedRevision: 0, draft: draft() });
    const foreign = await fetch(`${f.base}/api/compare`, { method: 'POST',
      headers: { origin: 'https://example.org', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1, provider: 'jev' }) });
    assert.equal(foreign.status, 403);
    const form = await fetch(`${f.base}/api/compare`, { method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ expectedRevision: 1, provider: 'jev' }) });
    assert.equal(form.status, 415);
    assert.equal(calls, 0);
    assert.equal((await f.ask('/api/state')).data.snapshot.revision, 1);
  } finally { await f.close(); }
});

test('comparison is explicit, cached by topic/version/provider, and adoption is a separate saved choice', async () => {
  let calls = 0;
  const f = await fixture({ providers: [{ id: 'jev', name: 'Jev 1.13', model: 'jev-1.13.0', configured: true }],
    suggestMethod: async () => { calls++; return { status: 'valid', model: 'jev-1.13.0', method: 'active recall', confidence: 0.7,
      probabilities: { 'active recall': 0.7, 'practice problems': 0.2, 'teach back': 0.1 } }; } });
  try {
    const saved = (await f.ask('/api/context', { expectedRevision: 0, draft: draft() })).data;
    assert.equal(calls, 0);
    const compared = await f.ask('/api/compare', { expectedRevision: 1, provider: 'jev' });
    assert.equal(compared.status, 200);
    assert.equal(calls, 1);
    assert.equal(compared.data.sprint.method, 'teach back');
    assert.equal(compared.data.suggestions[0].method, 'active recall');
    const cached = await f.ask('/api/compare', { expectedRevision: 2, provider: 'jev' });
    assert.equal(cached.status, 200);
    assert.equal(calls, 1);
    assert.equal(cached.data.snapshot.revision, 2);
    const id = compared.data.suggestions[0].id;
    const adopted = await f.ask('/api/adopt', { expectedRevision: 2, provider: 'jev', suggestionId: id, method: 'active recall' });
    assert.equal(adopted.status, 200);
    assert.equal(adopted.data.sprint.method, 'active recall');
    assert.equal(adopted.data.sprint.defaultMethod, 'teach back');
    assert.deepEqual(adopted.data.ranking.map(t => [t.id, t.priority]), saved.ranking.map(t => [t.id, t.priority]));
    const changed = await f.ask('/api/context', { expectedRevision: 3, draft: { ...draft(), topics: [{ ...draft().topics[0], id: saved.snapshot.topics[0].id, confidence: 2 }] } });
    assert.equal(changed.data.sprint.method, 'teach back');
    assert.equal(changed.data.suggestions.length, 0);
    const stale = await f.ask('/api/adopt', { expectedRevision: 4, provider: 'jev', suggestionId: id, method: 'active recall' });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.error.code, 'STALE_SUGGESTION');
  } finally { await f.close(); }
});

test('a context change during an in-flight model call discards the stale result', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture({ providers: [{ id: 'jev', name: 'Jev 1.13', model: 'jev-1.13.0', configured: true }],
    suggestMethod: async () => pending });
  try {
    const saved = (await f.ask('/api/context', { expectedRevision: 0, draft: draft() })).data;
    const request = f.ask('/api/compare', { expectedRevision: 1, provider: 'jev' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const changed = await f.ask('/api/context', { expectedRevision: 1, draft: { ...draft(), topics: [{ ...draft().topics[0], id: saved.snapshot.topics[0].id, confidence: 2 }] } });
    assert.equal(changed.status, 200);
    release({ status: 'valid', model: 'jev-1.13.0', method: 'active recall' });
    const stale = await request;
    assert.equal(stale.status, 409);
    assert.equal((await f.ask('/api/state')).data.suggestions.length, 0);
  } finally { await f.close(); }
});

test('two overlapping Compare actions share one provider request', async () => {
  let calls = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture({ providers: [{ id: 'jev', name: 'Jev 1.13', model: 'jev-1.13.0', configured: true }],
    suggestMethod: async () => { calls++; return pending; } });
  try {
    await f.ask('/api/context', { expectedRevision: 0, draft: draft() });
    const first = f.ask('/api/compare', { expectedRevision: 1, provider: 'jev' });
    const second = f.ask('/api/compare', { expectedRevision: 1, provider: 'jev' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(calls, 1);
    release({ status: 'valid', model: 'jev-1.13.0', method: 'teach back' });
    const results = await Promise.all([first, second]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal((await f.ask('/api/state')).data.snapshot.revision, 2);
  } finally { await f.close(); }
});
