const $ = selector => document.querySelector(selector);
const state = { connected: false, sample: false, resume: null, scopeVersion: 0, pending: null, workspaceVersion: 0, dirty: false, suggestedSummary: "", ready: false };
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
function setReady(ready) {
  state.ready=ready;
  window.dispatchEvent(new CustomEvent('career:setup-state',{detail:{ready}}));
}
function changed() {state.dirty=true;setReady(false);}
function renderSummary(passages, tagText, version, draft, review = null) {
  $('#facts-panel').hidden=false;$('#empty-facts').hidden=true;
  $('#summary-tag').textContent=tagText;
  $('#summary-version').textContent=`Resume v${version}${review ? ` · confirmed with scope v${state.scopeVersion}` : ' · review needed'}`;
  state.suggestedSummary=draft?.text || '';
  $('#resume-summary').value=review?.text || state.suggestedSummary;
  $('#summary-confirmed').checked=Boolean(review?.text);
  $('#summary-state').textContent=review?.text?'Saved and confirmed':'Review needed';
  const sources=$('#summary-sources');sources.replaceChildren();
  for(const p of passages || []){const row=document.createElement('p');row.textContent=`${p.reference}: ${p.text}`;sources.append(row);}
}
function clearForm(){
  state.resume=null;state.sample=false;state.pending=null;state.dirty=false;state.optionalFacts={};state.hardConstraints=[];
  $('#resume-file').value='';$('#upload-resume').disabled=true;$('#facts-panel').hidden=true;$('#empty-facts').hidden=false;
  $('#resume-summary').value='';$('#summary-confirmed').checked=false;$('#answer-panel').hidden=true;
  for(const id of ['start-date','end-date','role-interests','location','available-hours','available-locations','minimum-pay','pay-currency','authorized-us','remote-available'])$('#'+id).value='';
  $('#internship').checked=false;$('#entry-level').checked=false;
  $('#file-feedback').textContent='Choose a resume to start your new setup. Saved originals are retained.';
  $('#question-kind').textContent='NEW SETUP';$('#question-heading').textContent='Ready for a fresh start';
  $('#question-text').textContent='Upload your resume and confirm its summary and search focus.';
  $('#question-detail').textContent='Your earlier opportunities and downloads remain on the Opportunities page.';
  setReady(false);
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
  state.workspaceVersion=data.workspace_version ?? state.workspaceVersion;
  if(data.setup_reset)clearForm();
  if (data.pending_resume) {
    state.resume = { id: data.pending_resume.id, version_number: data.pending_resume.version_number };
    renderSummary(data.pending_resume.passages, 'UPLOADED RESUME', data.pending_resume.version_number,data.pending_resume.summary_draft);
    $('#file-feedback').textContent = 'Your original is stored privately. Review and confirm the summary below.';
    say('Resume uploaded. Review the summary, make changes if needed, then confirm and save your choices.');
  }
  if (data.status === 'complete') {
    if (!data.pending_questions?.length) {
      state.pending = null;
      $('#answer-panel').hidden = true;
      $('#question-kind').textContent = data.summary_review_required?'SUMMARY REVIEW':'SETUP READY';
      $('#question-heading').textContent = data.summary_review_required?'Review your resume summary':'Ready for the next step';
      $('.question-icon').textContent = '✓';
      $('#question-text').textContent = data.summary_review_required?'Confirm the editable summary before your next search.':'Your resume and search choices are confirmed.';
      $('#question-detail').textContent = 'Open Opportunities to search and review evidence-backed fit assessments.';
    }
    state.resume = { id: data.resume.id, version_number: data.resume.version_number };
    renderSummary(data.resume.extracted_passages, 'SAVED RESUME', data.resume.version_number, data.summary_draft, data.scope.resume_review);
    $('#start-date').value = data.scope.start_date;
    $('#end-date').value = data.scope.end_date;
    $('#internship').checked = data.scope.role_types.includes('internship');
    $('#entry-level').checked = data.scope.role_types.includes('entry-level');
    $('#role-interests').value = data.scope.role_interests.join(', ');
    $('#location').value = data.scope.location_preference || '';
    state.optionalFacts = data.scope.optional_facts || {};
    state.hardConstraints = data.scope.hard_constraints || [];
    $('#available-hours').value = state.optionalFacts.available_hours_per_week ?? '';
    $('#available-locations').value = (state.optionalFacts.available_locations || []).join('; ');
    $('#remote-available').value = state.optionalFacts.remote_available === undefined ? '' : state.optionalFacts.remote_available ? 'yes' : 'no';
    $('#authorized-us').value = state.optionalFacts.authorized_to_work_us === undefined ? '' : state.optionalFacts.authorized_to_work_us ? 'yes' : 'no';
    $('#minimum-pay').value = state.optionalFacts.minimum_hourly_pay?.amount ?? '';
    $('#pay-currency').value = state.optionalFacts.minimum_hourly_pay?.currency || '';
    state.dirty=false;setReady(!data.summary_review_required);
    if(data.summary_review_required)say('Review and confirm the new summary before your next search. Your saved history is retained.');
    else say(data.first_run_empty ? 'Setup saved. No opportunities have been logged yet.' : 'Setup saved and opportunity history is available.');
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
      ? 'PRIVATE WORKSPACE · Resume storage connected · Evidence-backed fitness · Preparation drafts · Email coming later'
      : session.authenticated
        ? 'SYNTHETIC PREVIEW · Storage is not connected. No personal files are uploaded or saved.'
        : 'SIGN-IN REQUIRED · This setup belongs to a signed-in account.';
    $('#mode-pill').textContent = state.connected ? 'Private preview' : 'Preview mode';
    if (state.connected) await context(true);
  } catch {
    $('#mode-banner').className = 'preview-banner disconnected';
    $('#mode-banner').textContent = 'SYNTHETIC PREVIEW · Storage is not connected. No personal files are uploaded or saved.';
    $('#mode-pill').textContent = 'Preview mode';
  }
}
$('#load-sample').addEventListener('click', () => {
  state.sample=true;state.resume=null;$('#resume-file').value='';$('#upload-resume').disabled=true;
  const draft={text:'Education\nB.S. Information Systems, Minor in Applied Statistics.\n\nExperience\nData Volunteer, Campus Food Bank, March–August 2026. Cleaned inventory records and created a Power BI dashboard.\n\nSkills\nMicrosoft Excel, SQL, Power BI, and data cleaning.'};
  renderSummary([{text:draft.text,reference:'Maya Rivera fictional sample'}],'SYNTHETIC RESUME','sample',draft);
  $('#file-feedback').textContent='Fictional sample loaded locally. It cannot be saved to your account.';
  changed();say('Synthetic sample for exploration. Upload a resume to save your own setup.');
});
$('#resume-summary').addEventListener('input',()=>{$('#summary-confirmed').checked=false;$('#summary-state').textContent='Edited · confirm again';changed();});
$('#summary-confirmed').addEventListener('change',()=>{$('#summary-state').textContent=$('#summary-confirmed').checked?'Confirmed · save your setup':'Review needed';changed();});
$('#restore-summary').addEventListener('click',()=>{$('#resume-summary').value=state.suggestedSummary;$('#summary-confirmed').checked=false;$('#summary-state').textContent='Suggested summary restored · review and confirm';changed();});
for(const node of document.querySelectorAll('#setup input:not(#resume-file):not(#summary-confirmed),#setup select'))node.addEventListener('change',changed);
$('#resume-file').addEventListener('change', () => {
  const file = $('#resume-file').files?.[0];
  if (!file) return;
  state.sample = false;
  state.resume = null;
  changed();
  $('#facts-panel').hidden = true;
  $('#empty-facts').hidden = false;
  const permitted = /\.(pdf|docx|txt)$/i.test(file.name);
  const valid = permitted && file.size > 0 && file.size <= 5 * 1024 * 1024;
  $('#upload-resume').disabled = !valid || !state.connected;
  $('#file-feedback').textContent = !permitted ? 'Choose a PDF, DOCX, or TXT file.'
    : file.size === 0 ? 'This file is empty.'
      : file.size > 5 * 1024 * 1024 ? 'This file is over the 5 MB limit.'
        : state.connected ? `${file.name} selected. Extract it to review your summary.`
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
    renderSummary(data.passages || [], 'UPLOADED RESUME', data.resume.version_number, data.summary_draft);
    changed();
    $('#file-feedback').textContent = `Original stored privately. ${data.character_count} characters extracted. Review and confirm the summary below.`;
    say('Resume uploaded. Revise the summary if needed, confirm the final text, then save your choices.');
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
  const summary=$('#resume-summary').value.trim();
  if(!$('#summary-confirmed').checked || summary.length<20){say('Review your summary and confirm the final text before saving.');$('#resume-summary').focus();return;}
  if (!start || !end || end < start) { say('Choose a valid earliest and latest start date.'); return; }
  if (!roles.length) { say('Choose internships, entry-level jobs, or both.'); return; }
  if (!interests.length) { say('Enter at least one role interest.'); return; }
  const optionalFacts = {...(state.optionalFacts || {})};
  for (const field of ['available_hours_per_week','available_locations','remote_available','authorized_to_work_us','minimum_hourly_pay']) delete optionalFacts[field];
  const hours=$('#available-hours').value, places=$('#available-locations').value.trim(), pay=$('#minimum-pay').value, currency=$('#pay-currency').value.trim().toUpperCase();
  if(hours!=='')optionalFacts.available_hours_per_week=Number(hours);
  if(places)optionalFacts.available_locations=places.split(';').map(s=>s.trim()).filter(Boolean);
  for(const [id,key] of [['remote-available','remote_available'],['authorized-us','authorized_to_work_us']])if($('#'+id).value)optionalFacts[key]=$('#'+id).value==='yes';
  if(pay!==''||currency){if(pay===''||!/^[A-Z]{3}$/.test(currency)){say('An hourly minimum needs both an amount and a three-letter currency.');return;}optionalFacts.minimum_hourly_pay={amount:Number(pay),currency};}
  $('#review-preview').disabled = true;
  say('Saving your confirmed setup…');
  try {
    const { data } = await api('/api/g1/confirm', {
      resumeId: state.resume.id, expectedResumeVersion: state.resume.version_number,
      expectedScopeVersion: state.scopeVersion, expectedWorkspaceVersion: state.workspaceVersion, resumeReview:{text:summary,confirmed:true},
      scope: { startDate: start, endDate: end, roleTypes: roles, roleInterests: interests,
        locationPreference: $('#location').value.trim(), optionalFacts, hardConstraints: state.hardConstraints || [] },
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
  if(state.dirty){say('Confirm and save your current edits before checking readiness.');return;}
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
$('#reset-setup').addEventListener('click',()=>{$('#reset-feedback').textContent='';$('#reset-dialog').showModal();});
$('#reset-cancel').addEventListener('click',()=>$('#reset-dialog').close());
$('#reset-confirm').addEventListener('click',async()=>{
  $('#reset-confirm').disabled=true;
  try{
    if(state.connected){const {data}=await api('/api/g1/reset',{confirm:true,expectedWorkspaceVersion:state.workspaceVersion});
      if(!data.ok){$('#reset-feedback').textContent=data.message||'Reset could not be confirmed. Reload to inspect your setup.';return;}state.workspaceVersion=data.workspace_version;}
    clearForm();$('#reset-dialog').close();say('New setup started. Your saved history and downloads are retained.');window.CareerPages?.navigate('setup');
  }catch{$('#reset-feedback').textContent='Reset could not be confirmed. Reload to inspect your setup.';}
  finally{$('#reset-confirm').disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
document.body.dataset.previewScript = 'ready';
initialize();
