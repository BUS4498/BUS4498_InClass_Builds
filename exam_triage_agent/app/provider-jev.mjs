import { allowedMethods } from './core.mjs';

export const jevProvider = { id: 'jev', name: 'Jev 1.13', model: 'jev-1.13.0',
  get configured() { return Boolean(process.env.TYPESAFE_API_KEY); } };

const keyToMethod = { active_recall: 'active recall', practice_problems: 'practice problems', teach_back: 'teach back' };
const methodToKey = Object.fromEntries(Object.entries(keyToMethod).map(([key, value]) => [value, key]));

export function compactContext(snapshot, daysRemaining) {
  const topic = snapshot.topics.find(t => t.id === snapshot.sprint?.topicId);
  if (!topic) throw new Error('No current sprint topic');
  return {
    exam_format: snapshot.exam.format,
    topic_name: topic.name,
    confidence: topic.confidence,
    importance: topic.importance,
    ...(topic.difficultyNote ? { difficulty_note: topic.difficultyNote } : {}),
    days_remaining: daysRemaining,
    available_minutes: snapshot.exam.availableMinutes,
  };
}

export function jevRequestBody(state) {
  return {
    model: jevProvider.model,
    state,
    questions: { study_method: {
      type: 'choice',
      instructions: 'Choose one useful method for the next study session using only the supplied state. Do not calculate dates, rank topics, assume course materials or problems exist, predict a grade, or claim student mastery.',
      criteria: {
        active_recall: 'Recall ideas from memory, then check against the student’s course material.',
        practice_problems: 'Work through relevant course problems when the exam is problem based and the student has them.',
        teach_back: 'Explain the topic aloud or in writing, then check that explanation against course material.',
      },
    } },
  };
}

export function parseJevResponse(data) {
  const answer = data?.answers?.study_method;
  const method = keyToMethod[answer?.choice];
  if (answer?.type !== 'choice' || !allowedMethods.includes(method)) return { status: 'invalid', provider: 'jev', model: jevProvider.model, message: 'Jev returned an unsupported or incomplete method. The rule-based sprint is unchanged.' };
  const probabilities = answer.probabilities;
  if (!probabilities || typeof probabilities !== 'object' ||
      Object.keys(keyToMethod).some(key => !Number.isFinite(probabilities[key]) || probabilities[key] < 0 || probabilities[key] > 1) ||
      Math.abs(Object.keys(keyToMethod).reduce((sum, key) => sum + probabilities[key], 0) - 1) > 0.03) {
    return { status: 'invalid', provider: 'jev', model: jevProvider.model, message: 'Jev returned incomplete choice probabilities. The rule-based sprint is unchanged.' };
  }
  const confidence = answer.confidence;
  return {
    status: 'valid', provider: 'jev', model: typeof data.model === 'string' ? data.model : jevProvider.model,
    method, confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null,
    probabilities: Object.fromEntries(allowedMethods.map(m => [m, probabilities[methodToKey[m]]])),
    rationale: null,
  };
}

export async function suggestWithJev(state, { fetchImpl = fetch, key = process.env.TYPESAFE_API_KEY } = {}) {
  if (!key) return { status: 'unavailable', provider: 'jev', model: jevProvider.model,
    message: 'Jev is not configured on this computer. Add your own TypeSafe key to the ignored local .env file, then restart the app.' };
  try {
    const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(jevRequestBody(state)),
    });
    if (!response.ok) {
      const message = response.status === 401 ? 'Jev rejected the configured key. Check your local key and restart.' :
        response.status === 429 || response.status === 529 ? 'Jev is busy or rate limited. Try another explicit comparison later.' :
        `Jev could not complete the request (HTTP ${response.status}). The rule-based sprint is unchanged.`;
      return { status: 'failed', provider: 'jev', model: jevProvider.model, message };
    }
    return parseJevResponse(await response.json());
  } catch (error) {
    if (['EACCES', 'EPERM'].includes(error?.cause?.code)) {
      return { status: 'failed', provider: 'jev', model: jevProvider.model,
        message: 'This computer blocked the Jev connection. Check network permissions before choosing Compare again. The rule-based sprint is unchanged.' };
    }
    return { status: 'failed', provider: 'jev', model: jevProvider.model,
      message: 'Jev timed out or could not be reached. The rule-based sprint is unchanged.' };
  }
}
