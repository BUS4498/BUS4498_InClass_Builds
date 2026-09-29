const $ = (id) => document.getElementById(id);
let state = null;
let fictionalDraft = false;
let selectedProvider = 'jev';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shortDate = (value) => value ? new Date(value).toLocaleString() : 'Never studied in this plan';
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function status(message, kind = 'ok', allowReload = false) {
  const box = $('status');
  box.className = `status ${kind}`;
  box.textContent = message;
  if (allowReload) {
    const button = document.createElement('button');
    button.className = 'text-button';
    button.textContent = 'Reload saved plan';
    button.addEventListener('click', load);
    box.append(' ', button);
  }
}

async function request(path, payload) {
  let response;
  try {
    response = await fetch(path, { method: payload ? 'POST' : 'GET',
      headers: payload ? { 'content-type': 'application/json' } : {},
      body: payload ? JSON.stringify(payload) : undefined });
  } catch {
    throw { code: 'NETWORK_ERROR', message: 'The local app is not responding. Check the terminal, then reload.' };
  }
  const result = await response.json();
  if (!response.ok) throw result.error || { message: 'The action could not be completed.' };
  return result;
}

async function load() {
  try {
    const fresh = await request('/api/state');
    state = fresh;
    fictionalDraft = false;
    render();
    status(fresh.snapshot ? `Saved plan loaded · version ${fresh.snapshot.contextVersion}.` : 'No saved exam yet. Enter your own details or preview a fictional form.');
  } catch (error) { status(error.message, 'error', true); }
}

async function action(path, values, success) {
  if (!state) return;
  const comparing = path === '/api/compare';
  if (comparing) $('compare-button').disabled = true;
  status('Saving and checking the local file…', 'working');
  try {
    const fresh = await request(path, { expectedRevision: state.snapshot?.revision || 0, ...values });
    state = fresh;
    fictionalDraft = false;
    render();
    status(typeof success === 'function' ? success(fresh) : success);
  } catch (error) {
    const target = $('form-error');
    if (path === '/api/context') {
      target.textContent = error.field ? `${error.field}: ${error.message}` : error.message;
      target.hidden = false;
    }
    status(error.message, 'error', error.code === 'STALE_VERSION' || error.code?.startsWith('STORAGE'));
  } finally {
    if (comparing) $('compare-button').disabled = !state?.sprint;
  }
}

function topicRow(topic = {}, index = 0) {
  const row = document.createElement('div');
  row.className = 'topic-row';
  if (topic.id) row.dataset.id = topic.id;
  row.innerHTML = `<div class="topic-row-head"><strong>Topic ${index + 1}</strong><button class="text-button remove-topic" type="button">Remove</button></div>
    <div class="form-grid topic-grid">
      <label>Topic name<input class="topic-name" maxlength="100" value="${escapeHtml(topic.name || '')}" placeholder="e.g., Break-even analysis"></label>
      <label>Importance<select class="topic-importance"><option value="">Choose</option><option value="must know" ${topic.importance === 'must know' ? 'selected' : ''}>Must know</option><option value="other" ${topic.importance === 'other' ? 'selected' : ''}>Other</option></select></label>
      <label>My confidence<select class="topic-confidence"><option value="">Choose</option><option value="1" ${topic.confidence === 1 ? 'selected' : ''}>1 · Need practice</option><option value="2" ${topic.confidence === 2 ? 'selected' : ''}>2 · Partly ready</option><option value="3" ${topic.confidence === 3 ? 'selected' : ''}>3 · Fairly ready</option></select></label>
      <label>Difficulty note <span class="optional">optional</span><input class="topic-note" maxlength="240" value="${escapeHtml(topic.difficultyNote || '')}" placeholder="What feels difficult?"></label>
    </div>${topic.done ? '<p class="done-label">Currently marked done reviewing. Reopen it below to return it to the queue.</p>' : ''}`;
  row.querySelector('.remove-topic').addEventListener('click', () => {
    if ($('topic-rows').children.length <= 1) { $('form-error').textContent = 'Keep at least one topic.'; $('form-error').hidden = false; return; }
    row.remove();
    renumberTopics();
  });
  return row;
}

function renumberTopics() {
  [...$('topic-rows').children].forEach((row, i) => { row.querySelector('.topic-row-head strong').textContent = `Topic ${i + 1}`; });
  $('add-topic').disabled = $('topic-rows').children.length >= 6;
}

function renderForm() {
  const snapshot = state.snapshot;
  $('exam-name').value = snapshot?.exam.name || '';
  $('exam-date').value = snapshot?.exam.date || '';
  $('exam-date').min = todayLocal();
  $('exam-format').value = snapshot?.exam.format || '';
  $('available-minutes').value = snapshot?.exam.availableMinutes || '';
  $('version-label').textContent = snapshot ? `Context v${snapshot.contextVersion} · saved ${shortDate(snapshot.updatedAt)}` : 'No saved exam';
  $('topic-rows').replaceChildren(...(snapshot?.topics || [{}]).map(topicRow));
  renumberTopics();
  $('form-error').hidden = true;
  $('example-banner').hidden = !fictionalDraft;
}

function priorityCard(item, leading = false) {
  const row = document.createElement('article');
  row.className = `rank-item ${leading ? 'leading' : ''}`;
  row.innerHTML = `<div class="rank-top"><span class="rank-number">${item.rank.toString().padStart(2, '0')}</span><div><h3>${escapeHtml(item.name)}</h3><p>${item.importance === 'must know' ? 'Must know' : 'Other'} · Confidence ${item.confidence}/3</p></div><span class="score">${item.priority}</span></div>
    <p class="calculation">(4 − ${item.confidence}) × ${item.factor} = <strong>${item.priority} review index</strong></p>
    <p class="small-copy">${item.lastStudiedAt ? `Last studied: ${escapeHtml(shortDate(item.lastStudiedAt))}` : 'Never studied in this plan'}. ${escapeHtml(item.reason)}</p>
    ${item.difficultyNote ? `<p class="small-copy">Your note: ${escapeHtml(item.difficultyNote)}</p>` : ''}
    <button class="button small ${state.sprint?.topicId === item.id ? 'chosen' : 'ghost'}" type="button" ${state.sprint?.topicId === item.id ? 'disabled' : ''}>${state.sprint?.topicId === item.id ? 'Current sprint topic' : 'Build sprint for this topic'}</button>`;
  row.querySelector('button').addEventListener('click', () => action('/api/select', { topicId: item.id }, 'Sprint topic changed. Review order stayed the same.'));
  return row;
}

function renderRank() {
  const box = $('rank-content');
  const snapshot = state.snapshot;
  if (!snapshot) { box.className = 'empty-state'; box.textContent = 'Save an exam to see the ranked topics and the evidence for each position.'; $('days-label').textContent = 'No exam yet'; return; }
  $('days-label').textContent = state.daysRemaining === 0 ? 'Exam is today' : state.daysRemaining > 0 ? `${state.daysRemaining} days until exam` : 'Exam date has passed';
  if (!state.ranking.length) {
    box.className = 'empty-state';
    box.textContent = 'All topics are marked done reviewing. Reopen a topic below or edit your exam to create a new plan.';
    return;
  }
  box.className = '';
  const heading = document.createElement('p');
  heading.className = 'subtle';
  heading.textContent = `${state.top.length} of up to 3 leading topics shown${state.ranking.length < 3 ? ` · only ${state.ranking.length} in the queue` : ''}. Equal indices use oldest study date, then entry order.`;
  const top = document.createElement('div'); top.className = 'rank-list';
  state.top.forEach((item, i) => top.append(priorityCard(item, i === 0)));
  box.replaceChildren(heading, top);
  if (state.remaining.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = `Remaining queued topics (${state.remaining.length})`;
    const rest = document.createElement('div'); rest.className = 'rank-list';
    state.remaining.forEach(item => rest.append(priorityCard(item)));
    details.append(summary, rest); box.append(details);
  }
}

function renderSprint() {
  const box = $('sprint-content');
  const sprint = state.sprint;
  if (!sprint) { box.className = 'empty-state'; box.textContent = state.snapshot ? 'No sprint while every topic is marked done reviewing. Reopen a topic below.' : 'Your timed sprint appears after you save a topic.'; $('sprint-version').textContent = ''; return; }
  const topic = state.ranking.find(t => t.id === sprint.topicId);
  $('sprint-version').textContent = `Context v${sprint.contextVersion} · sprint r${sprint.revision}`;
  box.className = '';
  box.innerHTML = `<div class="sprint-feature"><div><span class="eyebrow">${sprint.selectedInsteadOfTop ? 'YOU CHOSE ANOTHER TOPIC' : 'TOP RECOMMENDATION'}</span><h3>${escapeHtml(sprint.topicName)}</h3><p>${escapeHtml(sprint.method)} · ${state.snapshot.exam.availableMinutes} minutes</p></div><span class="score">#${sprint.topicRank}</span></div>
    <p class="small-copy">Review evidence: index ${sprint.topicPriority} from confidence ${topic.confidence}/3 and ${topic.importance === 'must know' ? 'must-know factor 2' : 'other-topic factor 1'}. Active method: ${escapeHtml(sprint.method)}. Exam-format default: ${escapeHtml(sprint.defaultMethod)}. Source: ${escapeHtml(sprint.methodSource)}.</p>
    <ol class="steps">${sprint.steps.map(step => `<li><span class="minutes">${step.minutes} min</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.prompt)}</p></div></li>`).join('')}</ol>
    <p class="small-copy">The sprint is a plan. Log what actually happened below.</p>`;
}

function renderModel() {
  const select = $('provider-select');
  const providers = state.providers || [];
  if (!providers.some(p => p.id === selectedProvider)) selectedProvider = providers[0]?.id || '';
  select.innerHTML = providers.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === selectedProvider ? 'selected' : ''}>${escapeHtml(p.name)} · ${escapeHtml(p.model)}</option>`).join('');
  select.disabled = !providers.length;
  select.onchange = () => { selectedProvider = select.value; renderModel(); };
  const provider = providers.find(p => p.id === selectedProvider);
  $('provider-status').textContent = !provider ? 'No provider is available in this copy.' :
    provider.configured ? `${provider.name} is configured on this computer.` : `${provider.name} is not configured on this computer. A comparison will show setup guidance without sending data.`;
  const snapshot = state.snapshot;
  const topic = snapshot?.topics.find(t => t.id === state.sprint?.topicId);
  const fields = $('transmit-fields');
  if (!topic || !provider) {
    fields.textContent = 'Save or reopen a topic to see what a provider would receive.';
    $('compare-button').disabled = true;
    $('suggestion-content').replaceChildren();
    return;
  }
  const sent = [
    ['Exam format', snapshot.exam.format], ['Selected topic', topic.name],
    ['Your confidence', String(topic.confidence)], ['Importance', topic.importance],
    ...(topic.difficultyNote ? [['Your difficulty note', topic.difficultyNote]] : []),
    ['Days until exam', String(state.daysRemaining)], ['Available minutes', String(snapshot.exam.availableMinutes)],
  ];
  fields.innerHTML = `<dl>${sent.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl><p>Your exam name, other topics, session history, and identity are not sent.</p>`;
  $('compare-button').disabled = false;
  const box = $('suggestion-content');
  const suggestion = state.suggestions.find(s => s.provider === selectedProvider);
  if (!suggestion) { box.innerHTML = '<p class="small-copy">No current comparison for this topic and version.</p>'; return; }
  if (suggestion.status !== 'valid') {
    box.innerHTML = `<div class="suggestion-result error"><strong>${escapeHtml(suggestion.status)}</strong><p>${escapeHtml(suggestion.message || 'The provider could not supply a valid choice. Your sprint is unchanged.')}</p></div>`;
    return;
  }
  const probabilityText = suggestion.probabilities ? Object.entries(suggestion.probabilities)
    .map(([method, chance]) => `${escapeHtml(method)} ${Math.round(chance * 100)}%`).join(' · ') : '';
  box.innerHTML = `<div class="suggestion-result"><p class="eyebrow">PROVIDER SUGGESTION · ${escapeHtml(suggestion.model || provider.model)}</p><h4>${escapeHtml(suggestion.method)}</h4>
    <p>For ${escapeHtml(topic.name)} in context v${suggestion.contextVersion}. ${suggestion.rationale ? escapeHtml(suggestion.rationale) : 'Jev provides a typed choice rather than a written rationale.'}</p>
    ${suggestion.confidence != null ? `<p class="small-copy">Model certainty about this choice: ${Math.round(suggestion.confidence * 100)}%. This is not your mastery or a grade prediction.</p>` : ''}
    ${probabilityText ? `<p class="small-copy">Choice probabilities: ${probabilityText}.</p>` : ''}
    <button class="button small primary" id="adopt-button" type="button">Use this method for this sprint</button></div>`;
  $('adopt-button').addEventListener('click', () => action('/api/adopt',
    { provider: selectedProvider, suggestionId: suggestion.id, method: suggestion.method },
    'You chose the provider method for this sprint. The default remains visible.'));
}

function renderProgress() {
  const box = $('progress-content');
  const snapshot = state.snapshot;
  if (!snapshot) { box.className = 'empty-state'; box.textContent = 'Save your exam first. After studying, record actual minutes and your new confidence rating.'; return; }
  box.className = '';
  const options = snapshot.topics.map(t => `<option value="${escapeHtml(t.id)}" ${state.sprint?.topicId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  box.innerHTML = `<div class="progress-grid"><form id="log-form" class="log-form"><h3>Record a session</h3><div class="form-grid"><label>Topic<select id="log-topic">${options}</select></label><label>Actual minutes<input id="log-minutes" type="number" min="0" max="180" step="1" required placeholder="0–180"></label><label>New confidence<select id="log-confidence"><option value="1">1 · Need practice</option><option value="2">2 · Partly ready</option><option value="3">3 · Fairly ready</option></select></label></div><label class="check-label"><input id="no-study" type="checkbox"> No study occurred (required for a zero-minute log)</label><button class="button primary" type="submit">Save session and rerank</button></form>
  <div><h3>Queue status</h3><p class="subtle">Done reviewing means you chose to remove a topic from this exam's queue. It does not claim mastery.</p><div id="queue-controls" class="queue-controls"></div></div></div>`;
  const select = $('log-topic');
  const setConfidence = () => { $('log-confidence').value = String(snapshot.topics.find(t => t.id === select.value)?.confidence || 1); };
  select.addEventListener('change', setConfidence); setConfidence();
  $('log-form').addEventListener('submit', (event) => {
    event.preventDefault();
    action('/api/log', { entry: { topicId: select.value, minutes: Number($('log-minutes').value),
      confidence: Number($('log-confidence').value), noStudy: $('no-study').checked } }, 'Session recorded. Review order and sprint updated.');
  });
  const controls = $('queue-controls');
  snapshot.topics.forEach(t => {
    const row = document.createElement('div'); row.className = 'queue-row';
    row.innerHTML = `<span>${escapeHtml(t.name)}</span><button class="text-button" type="button">${t.done ? 'Reopen topic' : 'Mark done reviewing'}</button>`;
    row.querySelector('button').addEventListener('click', () => action('/api/done', { topicId: t.id, done: !t.done }, t.done ? 'Topic returned to the queue.' : 'Topic marked done reviewing.'));
    controls.append(row);
  });
}

function renderHistory() {
  const box = $('history-content');
  const snapshot = state.snapshot;
  if (!snapshot) { box.className = 'empty-state'; box.textContent = 'No saved changes yet.'; return; }
  const prior = snapshot.history.slice(0, 5);
  box.className = '';
  box.innerHTML = `<p class="subtle">Current context v${snapshot.contextVersion}, saved ${escapeHtml(shortDate(snapshot.updatedAt))}. ${snapshot.sessions.length} session log${snapshot.sessions.length === 1 ? '' : 's'}.</p>
    ${prior.length ? `<details><summary>Show prior versions (${snapshot.history.length} saved)</summary><ul class="history-list">${prior.map(h => `<li>Context v${h.contextVersion} · ${escapeHtml(h.action)} · ${escapeHtml(shortDate(h.at))}<br><span>${h.topics.map(t => `${escapeHtml(t.name)}: ${t.confidence}/3`).join(' · ')}</span></li>`).join('')}</ul></details>` : '<p class="subtle">No earlier version.</p>'}`;
}

function render() { renderForm(); renderRank(); renderSprint(); renderModel(); renderProgress(); renderHistory(); $('clear-confirm').hidden = true; $('clear-phrase').value = ''; $('show-clear').disabled = !state.snapshot; }

$('add-topic').addEventListener('click', () => { if ($('topic-rows').children.length < 6) { $('topic-rows').append(topicRow({}, $('topic-rows').children.length)); renumberTopics(); } });
$('exam-form').addEventListener('submit', (event) => {
  event.preventDefault();
  $('form-error').hidden = true;
  const topics = [...$('topic-rows').children].map(row => ({
    ...(row.dataset.id ? { id: row.dataset.id } : {}), name: row.querySelector('.topic-name').value,
    importance: row.querySelector('.topic-importance').value,
    confidence: Number(row.querySelector('.topic-confidence').value),
    difficultyNote: row.querySelector('.topic-note').value,
  }));
  const draft = { exam: { name: $('exam-name').value, date: $('exam-date').value,
    format: $('exam-format').value, availableMinutes: Number($('available-minutes').value) }, topics };
  action('/api/context', { draft }, 'Exam saved and read back. Review your rank and sprint.');
});
$('fictional-button').addEventListener('click', () => {
  const date = new Date(); date.setDate(date.getDate() + 7);
  $('exam-name').value = 'FICTIONAL: Quantitative Methods Quiz';
  $('exam-date').value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  $('exam-format').value = 'problem solving'; $('available-minutes').value = '25';
  $('topic-rows').replaceChildren(...[
    { name: 'FICTIONAL: Break-even calculations', importance: 'must know', confidence: 1 },
    { name: 'FICTIONAL: Probability tables', importance: 'other', confidence: 2 },
    { name: 'FICTIONAL: Reading charts', importance: 'must know', confidence: 3 },
  ].map(topicRow));
  fictionalDraft = true; $('example-banner').hidden = false; renumberTopics();
  status('Fictional values are in the form only. Submit to save this clearly labeled practice exam.');
  $('setup').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
$('show-clear').addEventListener('click', () => { $('clear-confirm').hidden = false; $('clear-phrase').focus(); });
$('cancel-clear').addEventListener('click', () => { $('clear-confirm').hidden = true; $('clear-phrase').value = ''; });
$('confirm-clear').addEventListener('click', () => action('/api/clear', { confirm: $('clear-phrase').value }, 'All Exam Triage app records were cleared and absence was verified.'));
$('compare-button').addEventListener('click', () => action('/api/compare', { provider: selectedProvider }, (fresh) => {
  const suggestion = fresh.suggestions.find(s => s.provider === selectedProvider);
  return suggestion?.status === 'valid' ? 'Provider suggestion saved for this topic and version. Your sprint is unchanged.' :
    'Comparison status saved. The rule-based sprint remains available.';
}));
load();
