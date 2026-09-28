// Text-only DOM construction: resume/posting/model content is never HTML.
(() => {
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const label=s=>String(s||'not assessed').replaceAll('_',' ');
  function payText(value){if(!value)return 'Not stated';try{const p=JSON.parse(value),v=p.value,amount=typeof v==='number'?v:v?.value??(v?.minValue!==undefined&&v?.maxValue!==undefined?`${v.minValue}–${v.maxValue}`:null);return amount!==null?`${amount} ${p.currency||'currency unknown'}${v?.unitText?` per ${v.unitText.toLowerCase()}`:''}`:value;}catch{return value;}}
  const link=(url,text)=>{const a=make('a',text);try{const u=new URL(url);if(u.protocol==='https:'){a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}}catch{}return a;};
  function list(items){const ul=make('ul');for(const s of items)ul.append(make('li',s));return ul;}
  function evidence(a){
    const detail=make('details',undefined,'fit-evidence');detail.append(make('summary','Why this score? View every criterion'));
    detail.append(make('p','Required qualifications count 2; preferred qualifications and supported role interest count 1. Matched earns full weight, partly matched earns half, a documented gap earns zero, and unknown keeps a range.'));
    if(a.score?.rated)detail.append(make('p',`Evidence supports ${a.score.earned_lower}–${a.score.earned_upper} out of ${a.score.total_weight} weighted points. The unrounded fraction is retained for ordering.`));
    for(const c of a.criteria||[]){
      const row=make('div',undefined,'criterion');row.append(make('h4',c.label),make('p',`${label(c.type)} · weight ${c.weight} · ${label(c.status)} · ${c.earned_lower}–${c.earned_upper} points`),make('p',c.explanation));
      for(const [title,refs] of [['Posting',c.posting],['Qualification heading',c.qualifier_context],['Student evidence',c.student]])for(const ref of refs||[]){row.append(make('strong',title),make('blockquote',ref.quote),make('small',`${ref.id} · ${ref.reference}`));}
      if(c.missing)row.append(make('p',`Unknown: ${c.missing} (${c.unknown_owner==='student'?'student fact':'posting fact'})`,'hint'));detail.append(row);
    }
    const constraints=make('details');constraints.append(make('summary','Eligibility, timing, and other constraints'));
    for(const c of a.constraints||[]){const item=make('div',undefined,'criterion');item.append(make('strong',`${label(c.field)}: ${label(c.status)}`),make('p',c.explanation));for(const ref of c.evidence||[])item.append(make('blockquote',ref.quote),make('small',`${ref.id} · ${ref.reference}`));constraints.append(item);}detail.append(constraints);
    const audit=make('details');audit.append(make('summary','Assessment steps and versions'),list((a.subtasks||[]).map(s=>`${s.name}: ${s.summary}`)),make('p',`Resume v${a.resume_version??'unknown'} · scope v${a.scope_version??'unknown'} · posting checked ${a.posting_version||'unknown'}`));detail.append(audit);
    return detail;
  }
  function card(c){
    const p=c.posting||{},a=c.assessment,el=make('article',undefined,'posting-card fit-card');
    const heading=make('div',undefined,'fit-card-heading'),identity=make('div');identity.append(make('p',p.employer||'Employer not verified','eyebrow'),make('h3',p.role||c.display_label||c.title||'Source check needed'));heading.append(identity);
    if(a?.score)heading.append(make('span',a.score.label,'fit-score'));el.append(heading);
    if(c.presentation?.rank)el.append(make('p',`Fit rank ${c.presentation.rank} · ${c.presentation.reason}`,'hint'));
    el.append(make('p',[p.location||'Location unknown',p.role_type||'Role type unknown',p.remote?'Remote work stated':'Work arrangement not confirmed'].join(' · ')));
    const details=make('dl',undefined,'posting-facts');for(const [name,value]of [['Start',p.start_date||'Exact date unknown'],['Pay',payText(p.compensation)],['Posted',p.posted_date||'Not stated'],['Deadline',p.deadline||'Not stated']])details.append(make('dt',name),make('dd',value));el.append(details);
    el.append(link(p.url||c.url,p.checked_at?'View checked posting':'Open discovery link'),make('small',`Source checked ${p.checked_at?new Date(p.checked_at).toLocaleString():'not verified'} · availability ${p.availability||'unknown'}`));
    if(a){
      const status=make('div',undefined,'fit-status');status.append(make('p',`Eligibility: ${label(a.eligibility)}`,a.eligibility==='conflict'?'error-note':''),make('p',`Preparation readiness: ${label(a.readiness)}`));el.append(status);
      if(a.eligibility==='conflict')el.append(make('p','A supported conflict or required gap remains. A fit score does not remove it.','error-note'));
      el.append(make('p',a.meaning||a.handoff||'Assessment interrupted. Available evidence is retained.','hint'),evidence(a));
      if(c.recommendation){el.append(make('h4',`Suggested next step: ${label(c.recommendation.action)}`),make('p',c.recommendation.reason),make('p',c.recommendation.next_step));
        if(c.recommendation.suggestions?.length){const prep=make('details');prep.append(make('summary','Ways to prepare for this role'),list(c.recommendation.suggestions.map(s=>`${({resume_tailoring:'Resume tailoring',cover_letter:'Tailored cover letter',interview_cards:'Interview flip cards'})[s.type]}: ${s.reason}`)),make('p','Open Preparation to request a DOCX draft or interview cards for this posting.','hint'));el.append(prep);}
        const prepLink=make('a','Prepare for this role');prepLink.href='/preparation?opportunity='+encodeURIComponent(c.opportunity_id||'');el.append(prepLink);
        el.append(make('small','Advice only. No student decision, application, or message has been made.'));
      }else el.append(make('p',c.next_step||'Recommendation has not completed.'));
      for(const q of c.questions||[]){const note=make('p',`Your answer is needed: ${q.question}`,'question-callout'),answer=make('a','Answer this posting’s question');answer.href=`#question-${encodeURIComponent(q.case_key)}`;note.append(make('br'),answer);el.append(note);}
      for(const g of a.gaps||[])if(g.owner==='source')el.append(make('p',`Source information needed: ${g.need}`,'question-callout'));
    }else el.append(make('p',c.reason||c.access_reason||'Assessment has not started.'),make('p',c.next_step||''));
    return el;
  }
  function render(run){
    const root=make('div');
    if(!run.ranking){
      if(run.status==='running'){root.append(make('p','Assessments are in progress. Final groups and ranking appear after all available results are checked.'));for(const c of run.candidates.filter(c=>c.assessment))root.append(card(c));}
      else{const unchanged=run.candidates.length>0&&run.candidates.every(c=>c.disposition==='excluded_unchanged');
        root.append(make('p',unchanged?`No new assessments were needed. All ${run.candidates.length} postings were unchanged from earlier runs. Your earlier scores, questions, and downloads remain in saved runs.`:'No completed fit ranking is available for this run. Review the logged posting dispositions and source coverage.'));
        if(run.candidates.length){const d=make('details');d.append(make('summary',`All logged postings (${run.candidates.length})`));for(const c of run.candidates){const item=card(c);item.prepend(make('p',label(c.disposition),'posting-status'));d.append(item);}root.append(d);}
      }return root;
    }
    const rank=run.ranking,shown=new Set([...rank.ranked,...rank.needs_information,...rank.source_queue]);
    root.append(make('p',rank.shortfall,'summary-shortfall'));
    for(const [title,ids,note]of [
      ['Ranked by fit',rank.ranked,'Scores describe resume evidence. Check each separate eligibility and readiness status before deciding what to do.'],
      ['A student fact could change the result',rank.needs_information,'These postings have no final rank. Answer the specific saved question below; current scores do not change automatically.'],
      ['More posting information needed',rank.source_queue,'These are employer or source questions. You are not asked to certify missing employer facts.']]){
      const group=make('section',undefined,'fit-group');group.append(make('h3',`${title} (${ids.length})`),make('p',note,'hint'));
      if(!ids.length)group.append(make('p','No postings in this group for this run.'));
      for(const id of ids){const c=run.candidates.find(c=>c.candidate_id===id);if(c)group.append(card(c));}root.append(group);
    }
    const other=run.candidates.filter(c=>!shown.has(c.candidate_id));
    if(other.length){const d=make('details');d.append(make('summary',`All other logged postings (${other.length})`));for(const c of other)d.append(card(c));root.append(d);}
    return root;
  }
  window.CareerFitView={render};
})();
