import test from 'node:test';
import assert from 'node:assert/strict';
import { compactContext, jevRequestBody, parseJevResponse, suggestWithJev } from '../app/provider-jev.mjs';
import { createOrUpdate } from '../app/core.mjs';

const now = new Date('2026-09-28T18:00:00.000Z');
const draft = { exam: { name: 'FICTIONAL: Quiz', date: '2026-10-05', format: 'problem solving', availableMinutes: 25 },
  topics: [{ name: 'FICTIONAL: Equations', importance: 'must know', confidence: 1, difficultyNote: 'I mix up two steps.' },
    { name: 'FICTIONAL: Other topic', importance: 'other', confidence: 3 }] };

test('only compact selected-topic fields enter a Jev Choice request', () => {
  const saved = createOrUpdate(null, draft, now);
  const state = compactContext(saved, 7);
  assert.deepEqual(Object.keys(state), ['exam_format', 'topic_name', 'confidence', 'importance', 'difficulty_note', 'days_remaining', 'available_minutes']);
  assert.equal(JSON.stringify(state).includes('FICTIONAL: Other topic'), false);
  assert.equal(JSON.stringify(state).includes('FICTIONAL: Quiz'), false);
  const body = jevRequestBody(state);
  assert.equal(body.model, 'jev-1.13.0');
  assert.equal(body.questions.study_method.type, 'choice');
  assert.deepEqual(Object.keys(body.questions.study_method.criteria), ['active_recall', 'practice_problems', 'teach_back']);
});

test('Jev output accepts only a valid typed method and probability distribution', () => {
  const valid = parseJevResponse({ model: 'jev-1.13.0', answers: { study_method: { type: 'choice', choice: 'practice_problems',
    probabilities: { active_recall: 0.1, practice_problems: 0.8, teach_back: 0.1 }, confidence: 0.72 } } });
  assert.equal(valid.status, 'valid');
  assert.equal(valid.method, 'practice problems');
  assert.equal(valid.probabilities['practice problems'], 0.8);
  assert.equal(parseJevResponse({ answers: { study_method: { type: 'choice', choice: 'watch_video' } } }).status, 'invalid');
  assert.equal(parseJevResponse({ answers: { study_method: { type: 'choice', choice: 'teach_back', probabilities: {} } } }).status, 'invalid');
});

test('missing key and rate limit make no automatic retry', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 429 }; };
  const missing = await suggestWithJev({}, { key: '', fetchImpl });
  assert.equal(missing.status, 'unavailable');
  assert.equal(calls, 0);
  const limited = await suggestWithJev({}, { key: 'fictional-test-key', fetchImpl });
  assert.equal(limited.status, 'failed');
  assert.equal(calls, 1);
});

test('network permission failure gives a recovery message without retrying', async () => {
  let calls = 0;
  const blocked = await suggestWithJev({}, { key: 'fictional-test-key', fetchImpl: async () => {
    calls++;
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'EACCES' } });
  } });
  assert.equal(blocked.status, 'failed');
  assert.match(blocked.message, /blocked the Jev connection/);
  assert.equal(calls, 1);
});
