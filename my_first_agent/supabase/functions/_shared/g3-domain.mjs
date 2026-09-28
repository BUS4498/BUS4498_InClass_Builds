import { g3ConstraintFindings } from './g3-constraints.mjs';
import { g3QualifierSupport,g3QualificationCatalog,g3RequirementCovered } from './g3-qualifications.mjs';
// T4/T5/T7 contracts. Scores, budgets, evidence references and routing are
// controlled here; model text cannot authorize an operation or choose a weight.
export const G3_LIMITS = Object.freeze({ taskMs:120000, modelCalls:6, toolCalls:6, toolMs:5000, recommendationMs:60000 });
export const G3_SUBTASKS = ['Compare Requirements','Evaluate Constraints','Examine Evidence Gaps','Incorporate Student Clarification','Form Evidence-Backed Assessment'];
const g3Text = value => String(value ?? '').trim();
const g3Norm = value => g3Text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const g3Fail = code => { throw new Error(code); };
const g3SafeText = text => g3Text(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[contact omitted]').replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g,'[contact omitted]');

export function g3Evidence(candidate, context) {
  if (!candidate.posting || !['verified_new','verified_changed'].includes(candidate.disposition)) g3Fail('ASSESSMENT_REQUIRES_VALIDATED_POSTING');
  const p=candidate.posting, resume=context.resume, scope=context.scope;
  if(!resume || !scope || !Array.isArray(resume.extracted_passages) || !Array.isArray(resume.confirmed_passage_ids)) g3Fail('ASSESSMENT_CONTEXT_MISSING');
  const refs=[];
  const add=(id,kind,text,reference,verified=true)=>{if(g3Text(text)&&!refs.some(r=>r.id===id))refs.push({id,kind,text:g3SafeText(text),reference,verified});};
  for(const e of p.evidence||[])add(e.id,'posting',e.text,`${p.url} · checked ${p.checked_at}`);
  for(const field of ['role','employer','start_date','deadline','posted_date','location','remote','availability','compensation','work_hours'])
    if(p[field]!==null && p[field]!==undefined)add(`posting:${field}`,'posting',`${field}: ${p[field]}`,`${p.url} · checked ${p.checked_at}`);
  // Only checked passages can establish a student fact. Unchecked text is not
  // silently promoted by the overall confirmation flag or sent to the model.
  for(const e of resume.extracted_passages.filter(e=>!resume.confirmed_summary&&resume.confirmed_passage_ids.includes(e.id))) {
    if(/@|https?:\/\/|linkedin\.com|\b(?:phone|address)\b/i.test(e.text))continue;
    add(`resume:v${resume.version_number}:${e.id}`,'student',e.text,`Resume v${resume.version_number}, ${e.reference}`);
  }
  if(!resume.confirmed_summary)add(`student:correction:v${resume.version_number}`,'student',resume.student_correction,`Student correction, resume v${resume.version_number}`);
  add(`student:summary:scope-v${resume.summary_scope_version}`,'student',resume.confirmed_summary,`Student-confirmed resume summary, scope v${resume.summary_scope_version}, resume v${resume.version_number}`);
  add('scope:interests','interest',(scope.role_interests||[]).join(', '),`Confirmed scope v${scope.version_number}`);
  add('scope:timeframe','student',`${scope.start_date} through ${scope.end_date}`,`Confirmed start-date search range v${scope.version_number}`);
  add('scope:location','preference',scope.location_preference,`Location preference v${scope.version_number}; not permission to relocate`);
  for(const [field,value] of Object.entries(scope.optional_facts||{}))add(`student:optional:${field}`,'student',`${field}: ${typeof value==='string'?value:JSON.stringify(value)}`,`Student-supplied optional fact v${scope.version_number}`);
  for(const answer of context.clarification||[])add('student:clarification:'+answer.id+':v'+answer.version_number,'student',answer.question+' Answer: '+answer.answer,'Student-supplied response to posting question '+answer.id+' v'+answer.version_number);
  const total=refs.reduce((n,r)=>n+r.text.length,0)+JSON.stringify(context.history||[]).length;
  if(total>100000)g3Fail('SUPPLIED_EVIDENCE_TOO_LARGE'); // No silent truncation.
  return {candidate_id:candidate.candidate_id,resume_version:resume.version_number,scope_version:scope.version_number,
    posting_version:p.checked_at,refs,posting:p,scope,history:context.history||[],clarification:context.clarification||null};
}

export function g3Citations(items,bundle,kinds) {
  if(!Array.isArray(items)||items.length>12)g3Fail('INVALID_EVIDENCE_CITATIONS');
  return items.map(c=>{
    const ref=bundle.refs.find(r=>r.id===c.id);
    if(!ref || !ref.verified || (kinds&&!kinds.includes(ref.kind)) || !g3Text(c.quote) || c.quote.length<3 || !ref.text.includes(c.quote))g3Fail('UNSUPPORTED_EVIDENCE_REFERENCE');
    return {id:ref.id,quote:c.quote,reference:ref.reference};
  });
}

export function g3Criteria(input,bundle) {
  if(!Array.isArray(input)||input.length>40)g3Fail('INVALID_CRITERION_LEDGER');
  const seen=new Set();let interests=0;
  return input.map((c,i)=>{
    if(!g3Text(c.label)||c.label.length>240||!['required','preferred','unclear','interest'].includes(c.type)||!['matched','partly_matched','documented_gap','unknown'].includes(c.status))g3Fail('INVALID_CRITERION');
    const posting=g3Citations(c.posting,bundle,['posting']),student=g3Citations(c.student,bundle,c.type==='interest'?['interest']:['student']);
    if(!posting.length)g3Fail('POSTING_QUALIFICATION_REFERENCE_REQUIRED');
    const supports=posting.map(e=>g3QualifierSupport(e,bundle));
    if(['required','preferred'].includes(c.type)){
      const supported=supports.some(s=>s.type===c.type)&&!supports.some(s=>s.type!==c.type&&s.type!=='unclear');
      if(!supported)c={...c,type:'unclear',status:'unknown',basis:'unknown',unknown_owner:'source',
        missing:`The posting does not clearly establish whether ${c.label} is required or preferred.`,
        explanation:'The cited qualification is retained as unknown because its requiredness is ambiguous in the source.'};
    }
    if(c.status==='matched'&&g3Text(c.missing))c={...c,status:'unknown',basis:'unknown',unknown_owner:'student',explanation:'The comparison names missing evidence, so full fulfillment is not established. '+c.explanation};
    if(c.status==='matched'&&/\b(gathering|collecting|gather|collect)\b/i.test(posting.map(e=>e.quote).join(' '))&&!/\b(gather\w*|collect\w*|acquir\w*|survey\w*|interview\w*)\b/i.test(student.map(e=>e.quote).join(' ')))
      c={...c,status:'unknown',basis:'unknown',unknown_owner:'student',missing:'A specific example of collecting or gathering data is not established by the cited student evidence.',explanation:'Analyzing supplied data does not by itself establish experience collecting it.'};
    const identity=g3Norm(c.label),exact=posting.map(e=>`${e.id}|${g3Norm(e.quote)}`).sort().join(';');
    if(seen.has(identity)||seen.has(exact))g3Fail('DUPLICATE_CRITERION');seen.add(identity);seen.add(exact);
    if(c.type==='interest' && (++interests>1||!student.length||c.status!=='matched'))g3Fail('UNSUPPORTED_INTEREST_CRITERION');
    if(c.type==='unclear'&&c.status!=='unknown')g3Fail('UNCLEAR_QUALIFICATION_MUST_STAY_UNKNOWN');
    if(c.status!=='unknown'&&!student.length)g3Fail('STUDENT_COMPARISON_REQUIRED');
    if(c.status==='unknown'&&(!g3Text(c.missing)||!['student','source'].includes(c.unknown_owner)))g3Fail('SPECIFIC_UNKNOWN_REQUIRED');
    if(c.type==='unclear'&&c.unknown_owner!=='source')g3Fail('POSTING_UNCERTAINTY_IS_SOURCE_OWNED');
    if(c.status==='documented_gap') {
      const text=student.map(e=>e.quote).join(' ');
      if(c.basis==='explicit_absence') {
        if(!/\b(no|not|never|cannot|can't|lack|without|unable)\b/i.test(text))g3Fail('ABSENCE_IS_NOT_A_GAP');
      } else if(c.basis==='numeric_nonfulfillment') {
        // Numeric nonfulfillment needs an explicit directly comparable unit;
        // neither total experience nor degree equivalence is guessed.
        const a=posting.map(e=>e.quote).join(' ').match(/\b(\d+(?:\.\d+)?)\s+(years?|hours?)\b/i);
        const b=text.match(/\b(\d+(?:\.\d+)?)\s+(years?|hours?)\b/i);
        if(!a||!b||a[2].replace(/s$/,'')!==b[2].replace(/s$/,'')||Number(b[1])>=Number(a[1]))g3Fail('UNVERIFIED_NONFULFILLMENT');
      } else g3Fail('DOCUMENTED_GAP_REQUIRES_EXPLICIT_NONFULFILLMENT');
    }
    if(c.status==='matched'&&/\b(professional|employment|paid work)\b/i.test(posting.map(e=>e.quote).join(' '))&&/\b(coursework|course project|class project)\b/i.test(student.map(e=>e.quote).join(' ')))g3Fail('COURSEWORK_IS_NOT_EMPLOYMENT');
    if(!g3Text(c.explanation)||c.explanation.length>1000)g3Fail('CRITERION_EXPLANATION_REQUIRED');
    const weight=['required','unclear'].includes(c.type)?2:1;
    const lower=c.status==='matched'?weight:c.status==='partly_matched'?weight/2:0;
    return {id:`criterion-${i+1}`,label:c.label,type:c.type,status:c.status,basis:c.basis,weight,earned_lower:lower,
      earned_upper:c.status==='unknown'?weight:lower,posting,student,missing:c.status==='unknown'?c.missing:null,
      unknown_owner:c.status==='unknown'?c.unknown_owner:null,explanation:c.explanation,
      qualifier_context:supports.filter(s=>s.type===c.type&&s.context).map(s=>s.context)};
  });
}

export function g3Score(criteria) {
  const comparable=criteria.some(c=>c.type!=='interest'&&c.status!=='unknown'&&c.student.length);
  const total=criteria.reduce((n,c)=>n+c.weight,0),earned=criteria.reduce((n,c)=>n+c.earned_lower,0),possible=criteria.reduce((n,c)=>n+c.earned_upper,0);
  const band=n=>Math.min(5,Math.floor(n*5)+1);
  if(!comparable||!total)return {label:'Insufficient evidence to rate',rated:false,lower:null,upper:null,fraction_lower:null,fraction_upper:null,total_weight:total,earned_lower:earned,earned_upper:possible};
  const low=earned/total,high=possible/total,a=band(low),b=band(high);
  return {rated:true,label:a===b?`${a}/5`:`${a}–${b}/5 provisional`,lower:a,upper:b,fraction_lower:low,fraction_upper:high,total_weight:total,earned_lower:earned,earned_upper:possible};
}

export function g3CheckCoverage(criteria,bundle){
  const units=g3QualificationCatalog(bundle).map(u=>g3Norm(u.quote));
  const quoted=criteria.filter(c=>c.type!=='interest').flatMap(c=>c.posting.map(e=>g3Norm(e.quote)));
  if(units.some(unit=>!quoted.some(q=>q.includes(unit)||(unit.includes(q)&&q.length>=unit.length*.65)||g3RequirementCovered(unit,q))))g3Fail('POSTING_REQUIREMENT_NOT_CLASSIFIED');
  return true;
}

export function g3Constraints(bundle,at=new Date().toISOString()) {
  return g3ConstraintFindings(bundle,at).map(c=>({...c,evidence:c.refs.map(id=>bundle.refs.find(r=>r.id===id)).filter(Boolean).map(r=>({id:r.id,kind:r.kind,quote:r.text,reference:r.reference}))}));
}

export function g3Gap(input,bundle) {
  if(!input||!['student','source'].includes(input.owner)||!g3Text(input.topic)||!g3Text(input.need)||!Array.isArray(input.affects)||!input.affects.length||input.affects.some(x=>!['fit','eligibility','readiness'].includes(x)))g3Fail('INVALID_EVIDENCE_GAP');
  const refs=g3Citations(input.posting,bundle,['posting']);
  if(input.owner==='student'&&(!g3Text(input.question)||!['text','yes_no','date','number'].includes(input.answer_type)))g3Fail('ANSWERABLE_QUESTION_REQUIRED');
  if(input.owner==='student'&&/\b(is (?:the|this) (?:posting|job|position|role) (?:still )?open|employer.*(?:confirm|deadline)|posting.*(?:deadline|pay))\b/i.test(input.question))g3Fail('STUDENT_CANNOT_CERTIFY_EMPLOYER_FACT');
  return {...input,posting:refs,question:input.owner==='student'?input.question:null};
}

const g3QuoteKey=items=>JSON.stringify(items.map(e=>[e.id,g3Norm(e.quote)]).sort());
function g3IdentifyGap(input,task) {
  const gap=g3Gap(input,task.bundle),quoted=g3QuoteKey(gap.posting);
  // Exact criterion evidence or a single structured posting field can identify
  // an issue independently of the model's wording. Broad narrative citations
  // do not establish that two differently named issues are the same.
  const criteria=task.criteria.filter(c=>c.status==='unknown'&&c.unknown_owner===gap.owner&&g3QuoteKey(c.posting)===quoted);
  if(criteria.length===1)return {...gap,target_id:criteria[0].id,topic:criteria[0].label};
  const fields={availability:['availability','Application availability'],location:['location','Location'],remote:['work_arrangement','Work arrangement'],work_hours:['hours','Weekly hours'],start_date:['start_date','Start date'],deadline:['deadline','Application deadline']};
  if(gap.posting.length===1){
    const cite=gap.posting[0],ref=task.bundle.refs.find(r=>r.id===cite.id),field=fields[cite.id.replace(/^posting:/,'')];
    const constraint=field&&(task.constraints||[]).find(c=>c.field===field[0]&&c.status==='unknown'&&c.unknown_owner===gap.owner&&c.refs.includes(cite.id));
    if(constraint&&ref?.text===cite.quote)return {...gap,target_id:`constraint:${constraint.field}`,topic:field[1],need:gap.owner==='source'?constraint.explanation:gap.need};
  }
  return {...gap,target_id:null};
}
const g3GapKey=gap=>gap.target_id?`${gap.owner}|${gap.target_id}`:JSON.stringify([gap.owner,g3Norm(gap.topic),g3QuoteKey(gap.posting)]);

export function g3NewTask(bundle,now=Date.now()) {
  return {bundle,started_ms:now,deadline_ms:now+G3_LIMITS.taskMs,model_calls:0,tool_calls:0,phase:'assessment',
    criteria:[],constraints:null,gaps:[],subtasks:[],pending_subtask:null,evidence_seen:[],trace:[],assessment:null,recommendation:null};
}

export function g3NextSubtasks(task) {
  if(task.pending_subtask)return [task.pending_subtask];
  const available=name=>{
    const previous=task.subtasks.filter(s=>s.name===name);
    return !previous.length||(previous.length<2&&(task.material_revision||0)>(previous.at(-1).material_revision||0));
  };
  return G3_SUBTASKS.filter(name=>{
    if(name==='Compare Requirements'||name==='Evaluate Constraints')return available(name);
    if(name==='Examine Evidence Gaps')return task.gaps.length<2&&task.subtasks.filter(s=>s.name===name).length<2;
    if(name==='Incorporate Student Clarification')return !!task.bundle.clarification&&!task.subtasks.some(s=>s.name===name);
    const studentQuestionNeeded=task.criteria.some(c=>c.status==='unknown'&&c.unknown_owner==='student');
    return task.subtasks.some(s=>s.name==='Compare Requirements')&&!!task.constraints&&(!studentQuestionNeeded||task.gaps.some(g=>g.owner==='student'&&g.affects.includes('fit')));
  });
}

export function g3ReserveModel(task,now=Date.now()) {
  if(task.phase==='recommendation') {
    if(task.recommendation_calls||now>=task.recommendation_deadline)g3Fail('RECOMMENDATION_LIMIT');
    task.recommendation_calls=1;return;
  }
  if(task.phase!=='assessment'||now>=task.deadline_ms||task.model_calls>=G3_LIMITS.modelCalls)g3Fail('ASSESSMENT_LIMIT');
  task.model_calls++;
}

export function g3ApplyStep(task,step,now=Date.now()) {
  if(now>=task.deadline_ms)g3Fail('ASSESSMENT_DEADLINE');
  if(!G3_SUBTASKS.includes(step.subtask)||!['none','retrieve_supplied_evidence','check_explicit_constraints'].includes(step.tool))g3Fail('UNPERMITTED_SUBTASK_OR_TOOL');
  if(task.pending_subtask&&(step.subtask!==task.pending_subtask||step.tool!=='none'))g3Fail('PENDING_SUBTASK_RESULT_REQUIRED');
  const previous=task.subtasks.filter(s=>s.name===step.subtask),refs=step.evidence_refs||[];
  if(!Array.isArray(refs)||refs.some(id=>!task.bundle.refs.some(e=>e.id===id)))g3Fail('INVALID_INPUT_REFERENCE');
  const retrievalOnly=step.tool==='retrieve_supplied_evidence'&&Array.isArray(step.criteria)&&step.criteria.length===0&&(step.subtask==='Compare Requirements'||(step.subtask==='Examine Evidence Gaps'&&!step.gaps?.length));
  const repeatable=['Compare Requirements','Evaluate Constraints','Form Evidence-Backed Assessment'].includes(step.subtask);
  const newGapStep=step.subtask==='Examine Evidence Gaps'&&previous.length<2&&(step.gaps||[]).length>0&&(step.gaps||[]).every(g=>!task.gaps.some(old=>g3GapKey(old)===g3GapKey(g3IdentifyGap(g,task))));
  const pendingGapRetrieval=retrievalOnly&&step.subtask==='Examine Evidence Gaps'&&previous.length<2&&task.gaps.length<2;
  // Referencing a different passage in the same pinned input is not a new
  // posting update or clarification. Only controller-verified new material
  // can increment this revision; the model cannot supply it in its action.
  if(previous.length && !newGapStep && !pendingGapRetrieval && (!repeatable||previous.length>=2||(task.material_revision||0)<=(previous.at(-1).material_revision||0)))g3Fail('SUBTASK_REPEAT_WITHOUT_NEW_EVIDENCE');
  if(step.subtask==='Incorporate Student Clarification'&&!task.bundle.clarification)g3Fail('NO_ENTRY_CLARIFICATION');
  if(retrievalOnly&&(step.gaps?.length||!refs.length))g3Fail('INVALID_EVIDENCE_RETRIEVAL_REQUEST');
  let compared;
  if(step.subtask==='Compare Requirements'&&!retrievalOnly){
    compared=g3Criteria(step.criteria,task.bundle);
    // A promise to classify later is not a completed comparison. Check the
    // ledger before consuming tools or recording completion.
    g3CheckCoverage(compared,task.bundle);
  }else if(step.criteria?.length)g3Fail('CRITERIA_OUTSIDE_COMPARE_SUBTASK');
  if(step.subtask==='Evaluate Constraints'&&step.tool!=='check_explicit_constraints')g3Fail('DETERMINISTIC_CONSTRAINT_CHECK_REQUIRED');
  if(step.subtask==='Form Evidence-Backed Assessment'&&(!task.subtasks.some(s=>s.name==='Compare Requirements')||!task.constraints))g3Fail('ASSESSMENT_INPUTS_NOT_CLASSIFIED');
  if(step.tool!=='none'){
    if(++task.tool_calls>G3_LIMITS.toolCalls)g3Fail('ASSESSMENT_TOOL_LIMIT');
    const start=Date.now();
    const output=step.tool==='retrieve_supplied_evidence'?task.bundle.refs.filter(e=>refs.includes(e.id)):g3Constraints(task.bundle);
    if(Date.now()-start>Math.min(G3_LIMITS.toolMs,task.deadline_ms-now))g3Fail('ASSESSMENT_TOOL_TIMEOUT');
    task.trace.push({subtask:step.subtask,tool:step.tool,refs,output,attempts:1});
    if(step.tool==='check_explicit_constraints')task.constraints=output;
  }
  task.evidence_seen=[...new Set([...task.evidence_seen,...refs])];
  if(retrievalOnly){
    // The tool result is supplied on the next model request. Completing this
    // same subtask then is not repetition of an already completed comparison.
    task.pending_subtask=step.subtask;
    return task;
  }
  if(compared)task.criteria=compared;
  const mergedGaps=task.gaps.map(g=>g3IdentifyGap(g,task));
  for(const input of step.gaps||[]) {
    const gap=g3IdentifyGap(input,task);
    if(!mergedGaps.some(g=>g3GapKey(g)===g3GapKey(gap)))mergedGaps.push(gap);
  }
  if(mergedGaps.length>2)g3Fail('MATERIAL_GAP_LIMIT');
  task.gaps=mergedGaps;
  const completed={name:step.subtask,evidence_refs:refs,material_revision:task.material_revision||0,summary:g3Text(step.summary).slice(0,1500)};
  if(step.subtask==='Form Evidence-Backed Assessment') {
    g3CheckCoverage(task.criteria,task.bundle);
    const score=g3Score(task.criteria),hardConflict=task.constraints.some(c=>c.hard&&c.status==='conflict'),requiredGap=task.criteria.some(c=>c.type==='required'&&c.status==='documented_gap');
    const unknownEligibility=task.criteria.some(c=>['required','unclear'].includes(c.type)&&c.status==='unknown')||task.constraints.some(c=>c.hard&&c.status==='unknown');
    const studentUnknown=task.criteria.filter(c=>c.status==='unknown'&&c.unknown_owner==='student');
    if(studentUnknown.length&&!task.gaps.some(g=>g.owner==='student'&&g.affects.includes('fit')))g3Fail('STUDENT_FIT_QUESTION_REQUIRED');
    task.subtasks.push(completed);
    task.assessment={status:'completed',partial:task.criteria.some(c=>c.status==='unknown')||task.constraints.some(c=>c.status==='unknown'),score,criteria:task.criteria,constraints:task.constraints,gaps:task.gaps,
      eligibility:hardConflict||requiredGap?'conflict':unknownEligibility?'undetermined':'no_identified_conflict',
      readiness:hardConflict||requiredGap?'blocked':unknownEligibility?'undetermined':'needs_student_review',
      meaning:score.rated?'Fit describes support in the supplied evidence. It is not offer probability, confirmed eligibility, or permission to apply.':'At least one posting qualification needs a verified student comparison before a number can be shown.',
      subtasks:task.subtasks,model_calls:task.model_calls,tool_calls:task.tool_calls,resume_version:task.bundle.resume_version,scope_version:task.bundle.scope_version,posting_version:task.bundle.posting_version};
    task.phase='recommendation';task.recommendation_deadline=now+G3_LIMITS.recommendationMs;
  }else task.subtasks.push(completed);
  task.pending_subtask=null;
  return task;
}

export function g3RecommendationEvidence(assessment) {
  return [
    ...assessment.criteria.map(finding=>({id:finding.id,kind:'criterion',finding})),
    ...assessment.constraints.map(finding=>({id:`constraint:${finding.field}`,kind:'constraint',finding})),
    ...assessment.gaps.map((finding,i)=>({id:`gap:${i+1}`,kind:'gap',finding}))
  ];
}

export function g3CheckRecommendation(input,assessment,{request=null,history=[]}={}) {
  if(!input||!['prioritize','monitor','prepare','follow_up','archive','ask_student'].includes(input.action)||!g3Text(input.reason)||!g3Text(input.next_step))g3Fail('INVALID_RECOMMENDATION');
  const known=new Set(g3RecommendationEvidence(assessment).map(item=>item.id));
  if(!Array.isArray(input.evidence_ids)||!input.evidence_ids.length||input.evidence_ids.some(id=>!known.has(id)))g3Fail('RECOMMENDATION_EVIDENCE_REQUIRED');
  if(input.action==='prioritize'&&(!assessment.score.rated||assessment.eligibility!=='no_identified_conflict'||assessment.readiness!=='needs_student_review'))g3Fail('UNSAFE_PRIORITIZE');
  if(input.action==='prepare'&&!request?.artifact_type)g3Fail('PREPARATION_WAS_NOT_REQUESTED');
  if(input.action==='follow_up'&&!history.some(h=>h.student_action&&h.id===input.history_id))g3Fail('FOLLOWUP_REQUIRES_STUDENT_ACTION');
  if(input.action==='archive'&&assessment.eligibility!=='conflict'&&!history.some(h=>h.student_decision==='archive'&&h.id===input.history_id))g3Fail('ARCHIVE_REQUIRES_SUPPORTED_REASON');
  if(input.action==='ask_student'&&!assessment.gaps.some(g=>g.owner==='student'))g3Fail('STUDENT_QUESTION_NOT_PRESENT');
  if(input.action==='monitor'&&!assessment.constraints.some(c=>c.status==='unknown'&&c.unknown_owner==='source')&&!assessment.gaps.some(g=>g.owner==='source'))g3Fail('MONITOR_REQUIRES_SOURCE_OR_FUTURE_CONDITION');
  if(!Array.isArray(input.suggestions)||input.suggestions.length>3||input.suggestions.some(s=>!['resume_tailoring','cover_letter','interview_cards'].includes(s.type)||!g3Text(s.reason)))g3Fail('INVALID_PREPARATION_SUGGESTION');
  return {...input,status:'completed',advisory_only:true,student_decision:null,preparation_status:'not_requested'};
}

export function g3Rank(candidates) {
  const assessed=candidates.filter(c=>c.assessment?.status==='completed'&&c.recommendation?.status==='completed'),scored=assessed.filter(c=>c.assessment.score.rated);
  const fraction=(c,bound)=>c.assessment.score[`fraction_${bound}`];
  const stableId=c=>c.posting?.job_id||c.posting?.url||c.candidate_id;
  const tie=(a,b)=>(b.posting?.posted_date||'').localeCompare(a.posting?.posted_date||'')||stableId(a).localeCompare(stableId(b));
  const order=(a,ab,b,bb)=>fraction(b,bb)-fraction(a,ab)||tie(a,b);
  const ranked=[],needs=[],source=[],unrated=[];
  for(const c of assessed){
    const a=c.assessment,s=a.score;
    const changing=s.rated&&(s.lower!==s.upper||scored.some(other=>other!==c&&Math.sign(order(c,'lower',other,'upper'))!==Math.sign(order(c,'upper',other,'lower'))));
    const personal=a.criteria.some(k=>k.status==='unknown'&&k.unknown_owner==='student'),external=a.criteria.some(k=>k.status==='unknown'&&k.unknown_owner==='source');
    if((changing||!s.rated)&&external){c.presentation={group:'source_queue',rank:null,reason:'A posting qualification could change the score or order.'};source.push(c);}
    else if((changing||!s.rated)&&personal){c.presentation={group:'needs_information',rank:null,reason:'A specific student fact could change the score or order.'};needs.push(c);}
    else if(s.rated){c.presentation={group:'ranked',rank:null,reason:s.fraction_lower===s.fraction_upper?'Evidence-supported score and order.':'Score band and order are stable despite the disclosed unknown.'};ranked.push(c);}
    else {c.presentation={group:'unrated',rank:null,reason:'Insufficient evidence for a score.'};unrated.push(c);}
  }
  ranked.sort((a,b)=>order(a,'lower',b,'lower'));ranked.forEach((c,i)=>c.presentation.rank=i+1);
  needs.sort((a,b)=>(b.assessment.score.fraction_upper??-1)-(a.assessment.score.fraction_upper??-1)||stableId(a).localeCompare(stableId(b)));
  const ids=xs=>xs.map(c=>c.candidate_id);
  return {ranked:ids(ranked.slice(0,5)),needs_information:ids(needs.slice(0,3)),source_queue:ids(source),unrated:ids(unrated),
    scored_total:ranked.length,ranked_shown:Math.min(5,ranked.length),needs_shown:Math.min(3,needs.length),
    shortfall:`${Math.min(5,ranked.length)} stable scored posting${ranked.length===1?'':'s'} and ${Math.min(3,needs.length)} needing a student fact. ${ranked.length<3?'Fewer than three qualify for the ranked summary. ':''}${needs.length<2?'Fewer than two qualify for the needs-information summary.':''}`.trim()};
}

export function g3Failure(task,code) {
  task.phase='failed';task.assessment={status:'escalated',failure_category:'operational',result:'undetermined',score:{rated:false,label:'Undetermined — assessment interrupted'},
    criteria:task.criteria,constraints:task.constraints||[],gaps:task.gaps,subtasks:task.subtasks,model_calls:task.model_calls,tool_calls:task.tool_calls,
    eligibility:'undetermined',readiness:'undetermined',handoff:`Assessment stopped: ${code}. Available evidence is retained; the operation was not retried.`};
  return task;
}
