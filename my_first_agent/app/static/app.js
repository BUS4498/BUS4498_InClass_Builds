const $ = selector => document.querySelector(selector);
const state = { connected: false, sample: false, resume: null, scopeVersion: 0, pending: null };
const say = message => { $('#review-status').textContent = message; };

async function api(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { response, data: await response.json() };
}
function showPending(item) {
  if (!item?.id) return;
  state.pending = item;
  $('#question-kind').textContent = 'PENDING QUESTION';
  $('#question-heading').textContent = 'We need one detail from you';
  $('.question-icon').textContent = '?';
  $('#question-text').textContent = item.question;
  const source = item.source_reference ? ` Source: ${item.source_reference}.` : '';
  $('#question-detail').textContent = item.response_due_at
    ? `Please respond by ${new Date(item.response_due_at).toLocaleDateString()}. Affected input: ${item.affected_input}.${source}`
    : `Affected input: ${item.affected_input}.${source}`;
  $('#answer-panel').hidden = false;
}
function renderPassages(passages, tagText, version, confirmedIds = []) {
  $('#sample-facts').hidden = true;
  const panel = $('#live-facts');
  panel.replaceChildren();
  panel.hidden = false;
  $('#facts-panel').hidden = false;
  $('#empty-facts').hidden = true;
  const heading = document.createElement('div');
  heading.className = 'facts-head';
  const tag = document.createElement('span');
  tag.className = 'sample-tag';
  tag.textContent = tagText;
  const count = document.createElement('span');
  count.textContent = `Resume version ${version} · ${passages.length} extracted passages`;
  heading.append(tag, count);
  panel.append(heading);
  for (const passage of passages.slice(0, 30)) {
    const row = document.createElement('div');
    row.className = 'fact';
    const content = document.createElement('div');
    const body = document.createElement('p');
    body.textContent = passage.text;
    const source = document.createElement('small');
    source.textContent = `Source: ${passage.reference}`;
    content.append(body, source);
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'fact-check';
    box.value = passage.id;
    box.checked = confirmedIds.includes(passage.id);
    label.append(box, document.createTextNode(' Confirm'));
    row.append(content, label);
    panel.append(row);
  }
  if (passages.length > 30) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = `${passages.length - 30} more passages were extracted. Review the original before confirming; you can correct any detail below.`;
    panel.append(note);
  }
  const label = document.createElement('label');
  label.className = 'form-label';
  label.htmlFor = 'live-correction';
  label.textContent = 'Anything to correct or add?';
  const correction = document.createElement('textarea');
  correction.id = 'live-correction';
  correction.rows = 3;
  correction.placeholder = 'Your correction stays separate from the original resume text.';
  panel.append(label, correction);
}
async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function context(viewOnly) {
  const { data } = await api('/api/g1/context', { viewOnly });
  if (data.scope_version !== undefined) state.scopeVersion = data.scope_version;
  if (data.scope?.version_number !== undefined) state.scopeVersion = data.scope.version_number;
  if (data.pending_questions?.length) showPending(data.pending_questions[0]);
  if (data.pending) showPending(data.pending);
  if (data.pending_resume) {
    state.resume = { id: data.pending_resume.id, version_number: data.pending_resume.version_number };
    renderPassages(data.pending_resume.passages, 'UPLOADED RESUME', data.pending_resume.version_number);
    $('#file-feedback').textContent = 'Your uploaded original is stored privately. Confirm the passages you trust to finish setup.';
    say('Resume uploaded. Confirm at least one passage or write a correction, then save your choices.');
  }
  if (data.status === 'complete') {
    if (!data.pending_questions?.length) {
      state.pending = null;
      $('#answer-panel').hidden = true;
      $('#question-kind').textContent = 'SETUP READY';
      $('#question-heading').textContent = 'Ready for the next step';
      $('.question-icon').textContent = '✓';
      $('#question-text').textContent = 'Your resume and search choices are confirmed.';
      $('#question-detail').textContent = 'Open Opportunities to start discovery. Fitness recommendations will be added in G3.';
    }
    state.resume = { id: data.resume.id, version_number: data.resume.version_number };
    renderPassages(data.resume.extracted_passages, 'SAVED RESUME', data.resume.version_number,
      data.resume.confirmed_passage_ids || []);
    $('#start-date').value = data.scope.start_date;
    $('#end-date').value = data.scope.end_date;
    $('#internship').checked = data.scope.role_types.includes('internship');
    $('#entry-level').checked = data.scope.role_types.includes('entry-level');
    $('#role-interests').value = data.scope.role_interests.join(', ');
    $('#location').value = data.scope.location_preference || '';
    say(data.first_run_empty ? 'Setup saved. No opportunities have been logged yet.' : 'Setup saved and opportunity history is available.');
  } else if (data.question) say(data.recorded_response
    ? `Your ${data.recorded_response.response_kind} response was recorded. ${data.question}` : data.question);
  return data;
}
async function initialize() {
  try {
    const [sessionResponse, statusResponse] = await Promise.all([
      fetch('/api/session', { credentials: 'same-origin' }),
      fetch('/api/status', { credentials: 'same-origin' }),
    ]);
    const session = await sessionResponse.json();
    const server = await statusResponse.json();
    state.connected = Boolean(session.authenticated && server.connected);
    if (session.display_name)
      $('#account-avatar').textContent = session.display_name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    const banner = $('#mode-banner');
    banner.className = `preview-banner ${state.connected ? 'connected' : session.authenticated ? 'disconnected' : 'error'}`;
    banner.textContent = state.connected
      ? 'PRIVATE WORKSPACE · Resume storage connected · G2 discovery preview · Fitness, preparation, and email are later features'
      : session.authenticated
        ? 'SYNTHETIC PREVIEW · Storage is not connected. No personal files are uploaded or saved.'
        : 'SIGN-IN REQUIRED · This setup belongs to a signed-in account.';
    $('#mode-pill').textContent = state.connected ? 'Private G2 preview' : 'Preview mode';
    if (state.connected) await context(true);
  } catch {
    $('#mode-banner').className = 'preview-banner disconnected';
    $('#mode-banner').textContent = 'SYNTHETIC PREVIEW · Storage is not connected. No personal files are uploaded or saved.';
    $('#mode-pill').textContent = 'Preview mode';
  }
}
$('#load-sample').addEventListener('click', () => {
  state.sample = true;
  state.resume = null;
  $('#resume-file').value = '';
  $('#upload-resume').disabled = true;
  $('#live-facts').hidden = true;
  $('#sample-facts').hidden = false;
  $('#facts-panel').hidden = false;
  $('#empty-facts').hidden = true;
  $('#file-feedback').textContent = 'Fictional sample loaded locally. It cannot be saved to your account.';
  say('Synthetic sample loaded locally. Nothing has been saved.');
  $('#facts-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#resume-file').addEventListener('change', () => {
  const file = $('#resume-file').files?.[0];
  if (!file) return;
  state.sample = false;
  state.resume = null;
  $('#facts-panel').hidden = true;
  $('#empty-facts').hidden = false;
  const permitted = /\.(pdf|docx|txt)$/i.test(file.name);
  const valid = permitted && file.size > 0 && file.size <= 5 * 1024 * 1024;
  $('#upload-resume').disabled = !valid || !state.connected;
  $('#file-feedback').textContent = !permitted ? 'Choose a PDF, DOCX, or TXT file.'
    : file.size === 0 ? 'This file is empty.'
      : file.size > 5 * 1024 * 1024 ? 'This file is over the 5 MB limit.'
        : state.connected ? `${file.name} selected. Extract it to review source-linked passages.`
          : `${file.name} selected. Storage is not connected; it has not been uploaded.`;
  say('Nothing has been saved.');
});
$('#upload-resume').addEventListener('click', async () => {
  const file = $('#resume-file').files?.[0];
  if (!file || !state.connected) return;
  $('#upload-resume').disabled = true;
  $('#file-feedback').textContent = 'Uploading privately and reading source passages…';
  try {
    const { data } = await api('/api/g1/preview', { fileName: file.name, base64: await toBase64(file) });
    if (!data.ok) {
      $('#file-feedback').textContent = data.question || data.message || `Upload was not completed (${data.code}).`;
      showPending(data.pending);
      return;
    }
    state.resume = data.resume;
    renderPassages(data.passages || [], 'UPLOADED RESUME', data.resume.version_number);
    $('#file-feedback').textContent = `Original stored privately. ${data.character_count} characters extracted. Confirm the passages you trust.`;
    say('Resume uploaded. Confirm at least one passage or write a correction, then save your choices.');
  } catch { $('#file-feedback').textContent = 'Upload could not be completed. Please try again.'; }
  finally { $('#upload-resume').disabled = false; }
});
$('#review-preview').addEventListener('click', async () => {
  if (state.sample) { say('Synthetic sample is for exploration only. Choose a resume file to save your setup.'); return; }
  if (!state.connected) { say('Private setup storage is not connected yet. Nothing was saved.'); return; }
  if (!state.resume) { say('Choose and extract a readable resume first.'); return; }
  const start = $('#start-date').value, end = $('#end-date').value;
  const roles = [['internship', $('#internship')], ['entry-level', $('#entry-level')]].filter(([, node]) => node.checked).map(([role]) => role);
  const interests = $('#role-interests').value.split(',').map(item => item.trim()).filter(Boolean);
  const correction = $('#live-correction')?.value.trim() || '';
  const confirmed = [...$('#live-facts').querySelectorAll('.fact-check:checked')].map(node => node.value);
  if (!confirmed.length && !correction) { say('Confirm at least one source passage or write a correction.'); return; }
  if (!start || !end || end < start) { say('Choose a valid earliest and latest start date.'); return; }
  if (!roles.length) { say('Choose internships, entry-level jobs, or both.'); return; }
  if (!interests.length) { say('Enter at least one role interest.'); return; }
  $('#review-preview').disabled = true;
  say('Saving your confirmed setup…');
  try {
    const { data } = await api('/api/g1/confirm', {
      resumeId: state.resume.id, expectedResumeVersion: state.resume.version_number,
      expectedScopeVersion: state.scopeVersion, confirmedPassageIds: confirmed, correction,
      scope: { startDate: start, endDate: end, roleTypes: roles, roleInterests: interests,
        locationPreference: $('#location').value.trim(), optionalFacts: {}, hardConstraints: [] },
    });
    if (!data.ok) { say(data.question || `Setup was not saved (${data.code}). Refresh if a newer version exists.`); return; }
    state.scopeVersion = data.scope.version_number;
    say('Setup saved. Checking the read-back…');
    await context(true);
  } catch { say('Setup could not be saved. Please try again.'); }
  finally { $('#review-preview').disabled = false; }
});
$('#check-context').addEventListener('click', async () => {
  if (!state.connected) { say('Private setup storage is not connected yet.'); return; }
  try { await context(false); }
  catch { say('Readiness check could not be completed. No search was started.'); }
});
$('#answer-submit').addEventListener('click', async () => {
  if (!state.pending) return;
  const answer = $('#answer-text').value.trim();
  if (!answer) { say('Enter an answer, correction, or say the information is unavailable.'); return; }
  try {
    const { data } = await api('/api/g1/handoff', {
      handoffId: state.pending.id, responseKind: $('#answer-kind').value, responseText: answer,
    });
    if (!data.ok) { say(data.question || `Response was not saved (${data.code}).`); return; }
    state.pending = null;
    $('#answer-panel').hidden = true;
    $('#question-kind').textContent = 'RESPONSE SAVED';
    $('#question-heading').textContent = 'Response saved';
    $('#question-text').textContent = 'Your answer is recorded for the next context check.';
    $('#question-detail').textContent = 'It has not been assumed as a fact from your resume.';
    say('Response saved. Check readiness again when your setup is complete.');
  } catch { say('Response could not be saved. Please try again.'); }
});
document.body.dataset.previewScript = 'ready';
initialize();
