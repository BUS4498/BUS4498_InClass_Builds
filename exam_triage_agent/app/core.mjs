import { randomUUID } from 'node:crypto';

export class AppError extends Error {
  constructor(code, message, field = null, status = 400) {
    super(message);
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

const formats = new Set(['problem solving', 'written explanation', 'mixed/multiple choice']);
const methods = {
  'problem solving': 'practice problems',
  'written explanation': 'teach back',
  'mixed/multiple choice': 'active recall',
};

const fail = (field, message) => { throw new AppError('INVALID_INPUT', message, field); };
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(field, `Enter ${field} (up to ${max} characters).`);
  return value.trim();
};
const integer = (value, field, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(field, `${field} must be a whole number from ${min} to ${max}.`);
  return value;
};
const dateParts = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('exam date', 'Choose a valid exam date.');
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) fail('exam date', 'Choose a valid exam date.');
  return date;
};
export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export const daysRemaining = (date, today = localDate()) => Math.round((dateParts(date) - dateParts(today)) / 86400000);

export function validateDraft(draft, { today = localDate(), existing = null } = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) fail('exam', 'Enter the exam details.');
  const exam = {
    name: text(draft.exam?.name, 'exam name', 100),
    date: draft.exam?.date,
    format: draft.exam?.format,
    availableMinutes: integer(draft.exam?.availableMinutes, 'available study minutes', 15, 60),
  };
  dateParts(exam.date);
  if (daysRemaining(exam.date, today) < 0) fail('exam date', 'The exam date must be today or later.');
  if (!formats.has(exam.format)) fail('exam format', 'Choose one of the three exam formats.');
  if (!Array.isArray(draft.topics) || draft.topics.length < 1 || draft.topics.length > 6) fail('topics', 'Enter one to six topics.');
  const known = new Map((existing?.topics || []).map(topic => [topic.id, topic]));
  const seen = new Set();
  const topics = draft.topics.map((item, index) => {
    const field = `topic ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(field, `Complete ${field}.`);
    const id = item.id || randomUUID();
    if (typeof id !== 'string' || seen.has(id) || (item.id && !known.has(id))) fail(field, `${field} has an invalid or duplicate ID.`);
    seen.add(id);
    if (item.importance !== 'must know' && item.importance !== 'other') fail(`${field} importance`, `Choose importance for ${field}.`);
    const confidence = integer(item.confidence, `${field} confidence`, 1, 3);
    if (item.difficultyNote != null && (typeof item.difficultyNote !== 'string' || item.difficultyNote.length > 240)) fail(`${field} note`, `Keep the ${field} note under 240 characters.`);
    const old = known.get(id);
    return {
      id, name: text(item.name, `${field} name`, 100), importance: item.importance,
      confidence, difficultyNote: (item.difficultyNote || '').trim(),
      done: old?.done || false, lastStudiedAt: old?.lastStudiedAt || null,
      entryOrder: index,
    };
  });
  return { exam, topics };
}

export function validateStored(snapshot) {
  if (!snapshot || !Number.isInteger(snapshot.revision) || snapshot.revision < 1 ||
      !Number.isInteger(snapshot.contextVersion) || snapshot.contextVersion < 1 ||
      !Number.isInteger(snapshot.sprintRevision) || snapshot.sprintRevision < 1 ||
      !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.history)) {
    throw new AppError('CORRUPT_DATA', 'The saved app data is invalid. Your file was not changed.', null, 500);
  }
  try {
    const context = validateDraft(snapshot, { today: snapshot.exam.date, existing: snapshot });
    if (context.topics.some((topic, i) => topic.id !== snapshot.topics[i].id || snapshot.topics[i].entryOrder !== i ||
      typeof snapshot.topics[i].done !== 'boolean' ||
      (snapshot.topics[i].lastStudiedAt !== null && !Number.isFinite(Date.parse(snapshot.topics[i].lastStudiedAt))))) throw new Error();
    if (snapshot.selectedTopicId !== null && !snapshot.topics.some(t => t.id === snapshot.selectedTopicId && !t.done)) throw new Error();
    if (JSON.stringify(snapshot.sprint) !== JSON.stringify(composeSprint(snapshot))) throw new Error();
  } catch {
    throw new AppError('CORRUPT_DATA', 'The saved app data is invalid. Your file was not changed.', null, 500);
  }
  return snapshot;
}

export function rankTopics(snapshot) {
  const sorted = snapshot.topics.filter(t => !t.done).map(t => ({
    id: t.id, name: t.name, confidence: t.confidence, importance: t.importance,
    factor: t.importance === 'must know' ? 2 : 1,
    priority: (4 - t.confidence) * (t.importance === 'must know' ? 2 : 1),
    lastStudiedAt: t.lastStudiedAt, entryOrder: t.entryOrder,
    difficultyNote: t.difficultyNote,
  })).sort((a, b) => b.priority - a.priority ||
    (a.lastStudiedAt === null && b.lastStudiedAt === null ? 0 :
      a.lastStudiedAt === null ? -1 : b.lastStudiedAt === null ? 1 :
      Date.parse(a.lastStudiedAt) - Date.parse(b.lastStudiedAt)) || a.entryOrder - b.entryOrder);
  return sorted.map((item, index) => {
    const tied = sorted.some((other, i) => i !== index && other.priority === item.priority);
    return { ...item, rank: index + 1,
      reason: tied ? 'Equal index: never-studied topics come first, then the least recently studied, then entry order.' :
        'Ordered by the review index shown above.' };
  });
}

export function composeSprint(snapshot) {
  const ranking = rankTopics(snapshot);
  if (!ranking.length) return null;
  const topic = ranking.find(t => t.id === snapshot.selectedTopicId) || ranking[0];
  const minutes = snapshot.exam.availableMinutes;
  return {
    contextVersion: snapshot.contextVersion, revision: snapshot.sprintRevision,
    topicId: topic.id, topicName: topic.name, topicRank: topic.rank,
    topicPriority: topic.priority, selectedInsteadOfTop: topic.rank !== 1,
    method: methods[snapshot.exam.format], defaultMethod: methods[snapshot.exam.format],
    methodSource: 'exam-format default',
    steps: [
      { title: 'Set a goal', minutes: 2, prompt: `Choose one thing to understand or practice about ${topic.name}.` },
      { title: 'Work with your materials', minutes: minutes - 5, prompt: `Use ${methods[snapshot.exam.format]} with your own notes, practice items, or course materials.` },
      { title: 'Self-check', minutes: 3, prompt: 'Without looking first, check what you can explain or solve; then compare with your course materials.' },
    ],
  };
}

function historyEntry(snapshot, action, at) {
  return snapshot ? [{ contextVersion: snapshot.contextVersion, revision: snapshot.revision, action, at,
    exam: snapshot.exam, topics: snapshot.topics }, ...snapshot.history].slice(0, 20) : [];
}

export function createOrUpdate(current, draft, at = new Date()) {
  const { exam, topics } = validateDraft(draft, { today: localDate(at), existing: current });
  const next = {
    revision: (current?.revision || 0) + 1, contextVersion: (current?.contextVersion || 0) + 1,
    sprintRevision: (current?.sprintRevision || 0) + 1,
    exam, topics, selectedTopicId: null,
    sessions: current?.sessions || [], history: historyEntry(current, 'context revised', at.toISOString()),
    updatedAt: at.toISOString(),
  };
  next.sprint = composeSprint(next);
  return next;
}

export function selectTopic(current, topicId, at = new Date()) {
  if (!current.topics.some(t => t.id === topicId && !t.done)) fail('topic', 'Choose a topic still in the study queue.');
  const next = { ...current, revision: current.revision + 1, sprintRevision: current.sprintRevision + 1,
    selectedTopicId: topicId, history: historyEntry(current, 'sprint topic changed', at.toISOString()), updatedAt: at.toISOString() };
  next.sprint = composeSprint(next);
  return next;
}

export function setDone(current, topicId, done, at = new Date()) {
  if (typeof done !== 'boolean') fail('done status', 'Choose done or back in queue.');
  const topic = current.topics.find(t => t.id === topicId);
  if (!topic) fail('topic', 'Choose a saved topic.');
  const next = { ...current, revision: current.revision + 1, contextVersion: current.contextVersion + 1,
    sprintRevision: current.sprintRevision + 1, selectedTopicId: null,
    topics: current.topics.map(t => t.id === topicId ? { ...t, done } : t),
    history: historyEntry(current, done ? 'topic marked done reviewing' : 'topic reopened', at.toISOString()),
    updatedAt: at.toISOString() };
  next.sprint = composeSprint(next);
  return next;
}

export function logSession(current, entry, at = new Date()) {
  const topic = current.topics.find(t => t.id === entry?.topicId);
  if (!topic) fail('topic', 'Choose a saved topic.');
  const minutes = integer(entry.minutes, 'actual minutes', 0, 180);
  const confidence = integer(entry.confidence, 'new confidence', 1, 3);
  if (minutes === 0 && entry.noStudy !== true) fail('no study confirmation', 'Confirm that no study occurred when logging zero minutes.');
  const timestamp = at.toISOString();
  const next = { ...current, revision: current.revision + 1, contextVersion: current.contextVersion + 1,
    sprintRevision: current.sprintRevision + 1, selectedTopicId: null,
    topics: current.topics.map(t => t.id === topic.id ? { ...t, confidence,
      lastStudiedAt: minutes > 0 ? timestamp : t.lastStudiedAt } : t),
    sessions: [{ id: randomUUID(), topicId: topic.id, minutes, confidence, noStudy: minutes === 0,
      at: timestamp, localAt: at.toString() }, ...current.sessions].slice(0, 200),
    history: historyEntry(current, minutes === 0 ? 'no-study log' : 'study session logged', timestamp),
    updatedAt: timestamp };
  next.sprint = composeSprint(next);
  return next;
}

export function view(snapshot, now = new Date()) {
  if (!snapshot) return { snapshot: null, ranking: [], top: [], remaining: [], sprint: null, daysRemaining: null };
  validateStored(snapshot);
  const ranking = rankTopics(snapshot);
  return { snapshot, ranking, top: ranking.slice(0, 3), remaining: ranking.slice(3),
    sprint: snapshot.sprint, daysRemaining: daysRemaining(snapshot.exam.date, localDate(now)) };
}
