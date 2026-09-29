import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrUpdate, rankTopics, composeSprint, logSession, setDone, selectTopic, view } from '../app/core.mjs';

const now = new Date('2026-09-28T18:00:00.000Z');
const draft = (minutes = 25) => ({ exam: { name: 'FICTIONAL: Quiz', date: '2026-10-05', format: 'problem solving', availableMinutes: minutes }, topics: [
  { name: 'FICTIONAL: A', importance: 'must know', confidence: 2 },
  { name: 'FICTIONAL: B', importance: 'other', confidence: 1 },
  { name: 'FICTIONAL: C', importance: 'must know', confidence: 2 },
] });

test('priority uses exact formula, never-studied tie and entry order', () => {
  const saved = createOrUpdate(null, draft(), now);
  const ranked = rankTopics(saved);
  assert.deepEqual(ranked.map(t => [t.name, t.priority]), [
    ['FICTIONAL: A', 4], ['FICTIONAL: C', 4], ['FICTIONAL: B', 3],
  ]);
  const studied = logSession(saved, { topicId: saved.topics[0].id, minutes: 10, confidence: 2 }, new Date('2026-09-28T18:10:00Z'));
  assert.equal(rankTopics(studied)[0].name, 'FICTIONAL: C');
  assert.equal(studied.contextVersion, 2);
  assert.equal(studied.history[0].contextVersion, 1);
});

test('sprint boundaries sum exactly and selection does not rerank', () => {
  for (const minutes of [15, 60]) {
    const saved = createOrUpdate(null, draft(minutes), now);
    const sprint = composeSprint(saved);
    assert.deepEqual(sprint.steps.map(s => s.minutes), [2, minutes - 5, 3]);
    assert.equal(sprint.method, 'practice problems');
    const selected = selectTopic(saved, saved.topics[1].id, now);
    assert.equal(selected.sprint.topicId, saved.topics[1].id);
    assert.equal(selected.contextVersion, saved.contextVersion);
    assert.deepEqual(rankTopics(selected).map(t => t.id), rankTopics(saved).map(t => t.id));
  }
});

test('short queues and all-done status have no invented topic or sprint', () => {
  let saved = createOrUpdate(null, { ...draft(), topics: draft().topics.slice(0, 1) }, now);
  assert.equal(view(saved, now).top.length, 1);
  saved = setDone(saved, saved.topics[0].id, true, now);
  assert.equal(view(saved, now).top.length, 0);
  assert.equal(saved.sprint, null);
  saved = setDone(saved, saved.topics[0].id, false, now);
  assert.equal(view(saved, now).top.length, 1);
});

test('zero-minute session requires explicit no-study and preserves last-studied timestamp', () => {
  let saved = createOrUpdate(null, draft(), now);
  const id = saved.topics[0].id;
  saved = logSession(saved, { topicId: id, minutes: 12, confidence: 2 }, now);
  const studiedAt = saved.topics[0].lastStudiedAt;
  assert.throws(() => logSession(saved, { topicId: id, minutes: 0, confidence: 1 }, now), /Confirm that no study occurred/);
  const noStudy = logSession(saved, { topicId: id, minutes: 0, confidence: 1, noStudy: true }, new Date('2026-09-29T18:00:00Z'));
  assert.equal(noStudy.topics[0].lastStudiedAt, studiedAt);
  assert.equal(noStudy.topics[0].confidence, 1);
  assert.equal(noStudy.sessions[0].minutes, 0);
});

test('invalid edits do not mutate the previous saved object', () => {
  const saved = createOrUpdate(null, draft(), now);
  const before = JSON.stringify(saved);
  assert.throws(() => createOrUpdate(saved, { ...draft(), exam: { ...draft().exam, availableMinutes: 14 } }, now), /15 to 60/);
  assert.equal(JSON.stringify(saved), before);
});

test('a new day changes days remaining but not the rank index or order', () => {
  const saved = createOrUpdate(null, draft(), now);
  const first = view(saved, now);
  const later = view(saved, new Date('2026-09-29T18:00:00.000Z'));
  assert.equal(first.daysRemaining - later.daysRemaining, 1);
  assert.deepEqual(first.ranking.map(t => [t.id, t.priority]), later.ranking.map(t => [t.id, t.priority]));
});
