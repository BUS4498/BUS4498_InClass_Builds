(() => {
  const q=s=>document.querySelector(s), make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  let selected=null,busy=false,runs=[],questions=[],setupReady=false;
  const message=text=>q('#g2-message').textContent=text;
  const label=s=>String(s||'not started').replaceAll('_',' ');
  async function call(path,body){const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return r.json();}
  function controls(value){busy=value;q('#g2-start').disabled=value||!setupReady;q('#g2-synthetic').disabled=value||!setupReady;q('#g2-continue').disabled=value;q('#g2-refresh').disabled=value;q('#reset-setup').disabled=value;for(const b of document.querySelectorAll('.run-chip'))b.disabled=value;if(selected)window.CareerSearchProgress?.render(selected,value);}
  window.addEventListener('career:setup-state',e=>{setupReady=e.detail.ready;controls(busy);if(!setupReady&&!busy)message('Confirm and save your resume summary and search focus on My setup before starting another search.');else if(!busy)message('Your confirmed setup is ready for a search.');});
  function link(url,text){const a=make('a',text);if(typeof url==='string'&&url.startsWith('https://')){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}return a;}
  function render(run){
    if(selected?.id!==run.id)q('#g2-save-file').hidden=true;
    selected=run;q('#g2-result').hidden=false;q('#g2-notice').textContent=run.mode==='synthetic'?'SYNTHETIC TEST RUN':'LIVE SEARCH';
    window.CareerSearchProgress?.render(run,busy);
    q('#g2-heading').textContent=run.status==='running'?`Working: ${label(run.stage)}`:run.status==='complete'?(run.assessment_counters?'Search, assessments, and log complete':'Discovery and log complete'):run.status==='awaiting_student'?'Discovery logged · Your answer is needed':'Discovery needs attention';
    if(run.status==='complete'&&run.assessment_counters&&!run.candidates.some(c=>c.assessment?.status==='completed'))q('#g2-heading').textContent='Run logged · no completed assessments';
    q('#g2-detail').textContent=`${run.notice} ${run.mode === 'synthetic' ? 'Fixture' : 'Saved'} scope v${run.scope_version}, resume v${run.resume_version}. Hosted search calls: ${run.counters.hosted_reserved} reserved, ${run.counters.hosted_observed} observed${run.mode==='synthetic'?' (simulated reservations; no external calls)':''}.`;
    const grid=q('#g2-counters');grid.replaceChildren();
    const c=run.counters;for(const [name,value]of [[run.mode==='synthetic'?'Simulated search steps':'Search API attempts',c.api_attempts],['Leads screened',c.leads],['Direct posting reads',c.reads],['Pages skipped',c.skipped]]){const box=make('div',undefined,'counter');box.append(make('strong',String(value)),make('span',name));grid.append(box);}
    if(run.assessment_counters){const ac=run.assessment_counters;for(const [name,value]of [['Assessment requests',ac.model_calls],['Evidence tools',ac.tool_calls],['Next-action requests',ac.recommendation_calls],['Logged stable scores',run.ledger_status==='verified'?(run.ranking?.scored_total||0):0]]){const box=make('div',undefined,'counter');box.append(make('strong',String(value)),make('span',name+(run.mode==='synthetic'&&name!=='Logged stable scores'?' (simulated)':'')));grid.append(box);}}
    q('#g2-storage').textContent=`Ledger: ${label(run.ledger_status)} · Workbook: ${label(run.export_status)}${run.export_version?` · snapshot v${run.export_version}, ${run.export_row_count} logged rows`:''}`;
    q('#g2-continue').hidden=run.status!=='running';q('#g2-download').hidden=run.export_status!=='verified'||!run.export_id;
    const issues=q('#g2-issues');issues.replaceChildren();for(const issue of run.issues){
      const text=/REQUIREDNESS_NOT_SUPPORTED|PREFERENCE_NOT_SUPPORTED|POSTING_REQUIREMENT_NOT_CLASSIFIED/.test(issue)?'Assessment stopped because the qualification evidence could not be validated. This is a processing issue, not a judgment about your resume. The discovered postings and workbook were saved.':issue;
      issues.append(make('p',text,'error-note'));if(text!==issue){const d=make('details');d.append(make('summary','Technical detail'),make('p',issue));issues.append(d);}
    }
    const body=q('#g2-coverage');body.replaceChildren();
    for(const source of run.coverage){const tr=make('tr');for(const v of [source.name,label(source.status),source.attempts,source.leads,source.reads,source.verified])tr.append(make('td',String(v)));const detail=make('td');detail.append(make('p',`${source.reason||source.route||''}${source.non_posting_references?` · ${source.non_posting_references} search/help references excluded before screening job leads`:''}`));const d=make('details'),sum=make('summary','Search details');d.append(sum,make('p',`Requested: ${source.intent}`),make('p',`Provider queries: ${source.queries===null?'not supplied':source.queries.join(' | ')}`));detail.append(d);tr.append(detail);body.append(tr);}
    const cards=q('#g2-candidates');cards.replaceChildren();
    if(window.CareerLibrary&&!window.CareerLibrary.loaded){cards.append(make('p','Load your saved opportunity list to apply archive preferences.'));return;}
    const shownCandidates=run.candidates.filter(c=>!c.opportunity_id||!window.CareerLibrary||window.CareerLibrary.visible(run.mode,c.opportunity_id));
    const hiddenCount=run.candidates.length-shownCandidates.length;
    if(hiddenCount)cards.append(make('p',`${hiddenCount} archived posting${hiddenCount===1?' is':'s are'} hidden from these results. Restore them in Manage saved opportunities. This run’s original counts and downloads retain its full history.`,'hint'));
    run={...run,candidates:shownCandidates};
    if(run.ranking){const ids=new Set(shownCandidates.map(c=>c.candidate_id));run.ranking={...run.ranking,ranked:run.ranking.ranked.filter(id=>ids.has(id)),needs_information:run.ranking.needs_information.filter(id=>ids.has(id)),source_queue:run.ranking.source_queue.filter(id=>ids.has(id)),shortfall:hiddenCount?'Showing active postings from this saved run. Earlier scores and ranks are preserved.':run.ranking.shortfall};}
    renderQuestions(questions.filter(h=>h.run_id===run.id&&shownCandidates.some(c=>c.candidate_id===h.candidate_id)));
    if(hiddenCount&&!shownCandidates.length){cards.append(make('p','All postings from this run are archived.'));return;}
    if(run.assessment_counters&&window.CareerFitView){cards.append(window.CareerFitView.render(run));return;}
    const checked=run.candidates.filter(r=>r.disposition?.startsWith('verified_'));
    const held=run.candidates.filter(r=>r.disposition==='held_validation');
    const other=run.candidates.filter(r=>!checked.includes(r)&&!held.includes(r));
    const checkedBox=make('div'),heldBox=make('div'),otherBox=make('details');
    checkedBox.append(make('h3',`Source-verified postings (${checked.length})`));
    if(!checked.length)checkedBox.append(make('p','No source-verified postings in this run. Review coverage and excluded leads for the reasons.'));
    if(held.length)heldBox.append(make('h3',`Validation needed (${held.length})`));
    otherBox.append(make('summary',`Other screened leads (${other.length}) · exclusions and access issues`));
    cards.append(checkedBox,heldBox);if(other.length)cards.append(otherBox);
    if(!run.candidates.length)cards.append(make('p',run.status==='running'?'No leads recorded yet.':'No leads were returned. The coverage log explains what was attempted.'));
    for(const r of run.candidates){const p=r.posting||{},card=make('article',undefined,'posting-card');card.append(make('span',label(r.disposition||r.access),'posting-status'),make('h3',p.role||r.display_label||r.title||'Source check needed'),make('p',p.employer||'Employer not verified'),make('p',r.reason||r.access_reason||'Waiting for source verification.'));
      if(p.location)card.append(make('p',p.location));if(p.start_date)card.append(make('p',`Stated start: ${p.start_date}`));
      card.append(link(r.url,'Discovery source'));if(p.url&&p.url!==r.url)card.append(document.createTextNode(' · '),link(p.url,'Checked employer posting'));
      if(p.checked_at)card.append(make('small',`Checked ${new Date(p.checked_at).toLocaleString()} · ${p.availability} availability`));
      card.append(make('p',r.next_step||'Review the source note.'));
      if(p.evidence?.length){const d=make('details'),sum=make('summary','Posting evidence and unknowns');d.append(sum);for(const u of r.unknowns||[])d.append(make('p',u,'hint'));for(const e of p.evidence)d.append(make('p',`${e.id}: ${e.text}`));card.append(d);}(checked.includes(r)?checkedBox:held.includes(r)?heldBox:otherBox).append(card);
    }
  }
  function renderList(){const list=q('#g2-run-list');list.replaceChildren();for(const run of runs){const b=make('button',`${run.mode==='synthetic'?'Synthetic':'Live'} · ${new Date(run.started_at).toLocaleString()} · ${label(run.status)}`,'run-chip');b.type='button';b.addEventListener('click',()=>render(run));list.append(b);}}
  function renderQuestions(questions){const list=q('#g2-question-list');list.replaceChildren();q('#g2-questions').hidden=!questions.length;for(const h of questions){const card=make('div',undefined,'posting-card');card.append(make('h3',h.question),link(h.source_reference,'Posting reference'),make('p',`Status: ${label(h.status)} · respond by ${new Date(h.response_due_at).toLocaleDateString()}`));if(h.answer)card.append(make('p',`Your saved response: ${h.answer}`));
      if(h.case_data){card.id=`question-${h.case_data.case_key}`;card.prepend(make('p',`${h.case_data.employer||''} · ${h.case_data.role||''}`,'eyebrow'));card.append(make('p',`Why it matters: ${h.case_data.need}`),make('p',`Answer type: ${label(h.case_data.answer_type)} · resume v${h.case_data.resume_version} · scope v${h.case_data.scope_version}`,'hint'));if(h.case_data.posting_deadline)card.append(make('p',`Employer deadline: ${h.case_data.posting_deadline}${new Date(h.case_data.posting_deadline)<new Date(h.response_due_at)?' · earlier than the response target':''}.`));}
      if(h.status!=='response_received'){const input=make('textarea');input.rows=3;input.setAttribute('aria-label','Your response to this posting question');const select=make('select');select.setAttribute('aria-label','Response type');for(const [value,text]of [['answer','Answer or correction'],['unavailable','I do not know']]){const option=make('option',text);option.value=value;select.append(option);}const save=make('button','Save response','secondary-button');save.type='button';save.addEventListener('click',async()=>{save.disabled=true;try{const d=await call('/api/g2/answer',{questionId:h.id,requestKey:crypto.randomUUID(),expectedVersion:h.version_number,responseKind:select.value,answer:input.value.trim()||(select.value==='unavailable'?'I do not know.':'')});await refresh();message(d.message||d.code);}catch{message('The answer could not be confirmed. Inspect saved questions before sending it again.');}finally{save.disabled=false;}});card.append(input,select,save);}else card.append(make('p','Response saved. The original assessment remains unchanged until a new reassessment is requested.','hint'));list.append(card);}}
  async function refresh(){
    try{const data=await call('/api/g2/runs',{});if(!data.ok){message(data.message||`Discovery is unavailable (${data.code}).`);return;}runs=data.runs;questions=data.questions;await window.CareerLibrary?.refresh();renderList();if(runs.length)render(runs.find(r=>r.id===selected?.id)||runs[0]);if(!data.configured&&!runs.length)message('Synthetic testing is available. Live search needs the instructor’s hosted OpenAI configuration.');}
    catch{message('Saved runs could not be read. No search was started.');}
  }
  async function advance(){
    if(!selected||busy)return;controls(true);message('Working through the saved plan. Keep this tab open.');
    try{for(let step=0;step<260&&selected.status==='running';step++){
      const data=await call('/api/g2/step',{runId:selected.id,expectedRevision:selected.revision});
      if(data.run)render(data.run);if(!data.ok){message(data.message||`Stopped: ${label(data.code)}. Inspect the run before continuing.`);return;}
    }const checked=selected.candidates.filter(c=>c.posting?.checked_at).length,scored=selected.ranking?.scored_total||0,unchanged=selected.candidates.filter(c=>c.disposition==='excluded_unchanged').length;message(['complete','awaiting_student'].includes(selected.status)?`${scored} new fit scores; ${checked} posting details checked${unchanged?`; ${unchanged} already saved unchanged`:''}. ${scored?'Review your recommendations below.':'No new scored recommendations. Review source checks and saved postings below.'} Run log and workbook saved.`:selected.status==='running'?'Progress saved. Select Continue saved run to complete the remaining steps.':'The run stopped with an issue. Available evidence and storage status are shown below.');await refresh();}
    catch{message('Connection interrupted. The request was not retried. Use Inspect saved runs to check what was recorded.');}
    finally{controls(false);if(selected)window.CareerSearchProgress?.render(selected,false);}
  }
  async function start(mode){
    if(busy||!setupReady)return;controls(true);message(mode==='synthetic'?'Starting a fictional test run…':'Starting one search from your confirmed setup…');
    try{const data=await call('/api/g2/start',{requestKey:crypto.randomUUID(),mode});if(data.run)render(data.run);if(!data.ok){message(data.question||data.message||data.code);return;}controls(false);await advance();}
    catch{message('The start result is unknown. Inspect saved runs before starting another.');}
    finally{controls(false);}
  }
  q('#g2-start').addEventListener('click',()=>start('live'));q('#g2-synthetic').addEventListener('click',()=>start('synthetic'));q('#g2-refresh').addEventListener('click',refresh);q('#g2-continue').addEventListener('click',advance);
  q('#g2-download').addEventListener('click',async()=>{if(!selected?.export_id)return;q('#g2-download').disabled=true;try{const d=await call('/api/g2/download',{exportId:selected.export_id});if(!d.ok){message(d.code);return;}const bytes=Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0));const sum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(sum!==d.sha256)throw new Error('checksum');const a=q('#g2-save-file');a.href=`/api/g2/download?exportId=${encodeURIComponent(selected.export_id)}`;a.download=d.fileName;a.textContent=`Save ${d.fileName}`;a.hidden=false;message('Workbook verified. Select the Save link to download this snapshot.');}catch{message('Download could not be verified. No file was offered.');}finally{q('#g2-download').disabled=false;}});
  window.addEventListener('career:library-changed',()=>{if(selected)render(selected);});
  controls(false);refresh();
})();
