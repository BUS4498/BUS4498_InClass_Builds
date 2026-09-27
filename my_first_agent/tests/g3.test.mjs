import test from 'node:test';
import assert from 'node:assert/strict';
import { g2ParsePosting } from '../supabase/functions/_shared/g2-domain.mjs';
import { g3Evidence,g3Criteria,g3Score,g3Constraints,g3NewTask,g3NextSubtasks,g3ApplyStep,g3ReserveModel,g3Rank,g3CheckRecommendation,g3RecommendationEvidence,g3CheckCoverage } from '../supabase/functions/_shared/g3-domain.mjs';
import { G3_FIXTURE_CONTEXT,g3FixturePage,g3FixtureStep } from '../supabase/functions/_shared/g3-fixtures.mjs';
import { g3DecodeResponse,g3StepSchema,g3RecommendationSchema } from '../supabase/functions/_shared/g3-runtime.mjs';
import { g2Harness,finishFixture } from './g2-memory-harness.mjs';
import { validateScope } from '../supabase/functions/_shared/g1-domain.mjs';
import { createG3 } from '../supabase/functions/_shared/g3-runtime.mjs';

function task(id='BEACON'){
  const url=`https://careers.synthetic.example/jobs/${id}`;
  const posting=g2ParsePosting(g3FixturePage(url).text,url,'synthetic employer','2026-09-27T00:00:00Z').posting;
  return g3NewTask(g3Evidence({candidate_id:id,posting,disposition:'verified_new'},G3_FIXTURE_CONTEXT));
}
test('controller weights and exact thresholds distinguish unknowns from genuine gaps',()=>{
  for(const [earned,rating] of [[0,1],[1,2],[2,3],[3,4],[4,5],[5,5]]){
    const s=g3Score([{type:'required',status:'partly_matched',student:[{}],weight:5,earned_lower:earned,earned_upper:earned}]);assert.equal(s.lower,rating);
  }
  const t=task('CEDAR');const checked=g3Criteria(g3FixtureStep(t).criteria,t.bundle),score=g3Score(checked);
  assert.deepEqual([score.lower,score.upper,score.fraction_lower,score.fraction_upper],[3,5,.5,1]);
  const missing=checked.find(c=>c.status==='unknown');assert.equal(missing.earned_lower,0);assert.equal(missing.earned_upper,2);
});
test('interest alone and all-unknown qualifications never receive a fabricated score',()=>{
  assert.equal(g3Score([{type:'interest',status:'matched',student:[{}],weight:1,earned_lower:1,earned_upper:1}]).rated,false);
  assert.equal(g3Score([{type:'required',status:'unknown',student:[],weight:2,earned_lower:0,earned_upper:2}]).rated,false);
});
test('an omitted explicit requirement cannot disappear from the scoring denominator',()=>{
  const t=task('CEDAR'),criteria=g3Criteria(g3FixtureStep(t).criteria,t.bundle);
  assert.throws(()=>g3CheckCoverage(criteria.slice(0,1),t.bundle),/NOT_CLASSIFIED/);
  assert.equal(g3CheckCoverage(criteria,t.bundle),true);
});
test('fabricated quote, unconfirmed student evidence, inferred gap and duplicate criteria are rejected',()=>{
  const t=task('CEDAR'),input=g3FixtureStep(t).criteria;
  const bad=structuredClone(input);bad[0].student[0].quote='Fabricated SQL employment';assert.throws(()=>g3Criteria(bad,t.bundle),/UNSUPPORTED_EVIDENCE/);
  const gap=structuredClone(input);gap[1].status='documented_gap';gap[1].basis='explicit_absence';assert.throws(()=>g3Criteria(gap,t.bundle),/STUDENT_COMPARISON/);
  assert.throws(()=>g3Criteria([...input,input[0]],t.bundle),/DUPLICATE/);
  const context=structuredClone(G3_FIXTURE_CONTEXT);context.resume.confirmed_passage_ids=[];
  assert.equal(g3Evidence({candidate_id:'x',posting:t.bundle.posting,disposition:'verified_new'},context).refs.some(r=>r.id.startsWith('resume:')),false);
});
test('resume absence is unknown, explicit student absence can be a documented gap',()=>{
  const t=task('MAPLE'),checked=g3Criteria(g3FixtureStep(t).criteria,t.bundle);assert.equal(checked[1].status,'documented_gap');assert.equal(g3Score(checked).label,'3/5');
  const input=g3FixtureStep(task('CEDAR')).criteria;input[0].status='documented_gap';input[0].basis='explicit_absence';assert.throws(()=>g3Criteria(input,task('CEDAR').bundle),/ABSENCE_IS_NOT_A_GAP/);
});
test('model may select constraints before requirements; repeats and unauthorized tools are blocked',()=>{
  const t=task();g3ReserveModel(t);g3ApplyStep(t,{subtask:'Evaluate Constraints',tool:'check_explicit_constraints',evidence_refs:[],criteria:[],gaps:[],summary:'Check dates first'});
  assert.equal(t.subtasks[0].name,'Evaluate Constraints');g3ReserveModel(t);g3ApplyStep(t,g3FixtureStep(t));
  assert.throws(()=>g3ApplyStep(t,g3FixtureStep({...t,subtasks:[]})),/REPEAT_WITHOUT_NEW/);
  assert.throws(()=>g3ApplyStep(t,{subtask:'Compare Requirements',tool:'web_search'}),/UNPERMITTED/);
});
test('budgets persist across steps, deadline and max requests cannot reset',()=>{
  const t=task();for(let i=0;i<6;i++)g3ReserveModel(t);assert.throws(()=>g3ReserveModel(t),/ASSESSMENT_LIMIT/);
  const expired=task();assert.throws(()=>g3ReserveModel(expired,expired.deadline_ms),/ASSESSMENT_LIMIT/);
  assert.throws(()=>g3ApplyStep(expired,g3FixtureStep(expired),expired.deadline_ms),/ASSESSMENT_DEADLINE/);
});
test('readable source does not establish availability, eligibility, relocation or authorization',()=>{
  const findings=g3Constraints(task().bundle);assert.equal(findings.find(c=>c.field==='availability').status,'unknown');assert.equal(findings.find(c=>c.field==='location').status,'unknown');assert.equal(findings.find(c=>c.field==='work_authorization').status,'unknown');
});
test('within-band uncertainty that crosses another score cannot receive a final rank',()=>{
  const mk=(id,low,high,owner)=>({candidate_id:id,posting:{job_id:id,posted_date:'2026-09-01'},recommendation:{status:'completed'},assessment:{status:'completed',score:{rated:true,lower:5,upper:5,fraction_lower:low,fraction_upper:high},criteria:owner?[{status:'unknown',unknown_owner:owner}]:[]}});
  const a=mk('a',.82,.98,'student'),b=mk('b',.9,.9);const rank=g3Rank([a,b]);assert.deepEqual(rank.needs_information,['a']);assert.equal(a.presentation.rank,null);
  const x=mk('x',.82,.98,'source');assert.deepEqual(g3Rank([x,b]).source_queue,['x']);
  assert.deepEqual(g3Rank([mk('c',.9,.9),mk('b',.9,.9)]).ranked,['b','c']);
});
test('unsafe recommendation and provider-side tool or refusal output are rejected',()=>{
  const a={score:{rated:true},eligibility:'undetermined',readiness:'undetermined',criteria:[{id:'criterion-1'}],constraints:[],gaps:[]};
  assert.throws(()=>g3CheckRecommendation({action:'prioritize',reason:'High fit',next_step:'Apply',evidence_ids:['criterion-1']},a),/UNSAFE_PRIORITIZE/);
  assert.throws(()=>g3DecodeResponse({status:'completed',output:[{type:'web_search_call'}]}),/UNPERMITTED/);
  assert.throws(()=>g3DecodeResponse({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}),/REFUSAL/);
});
test('complete synthetic G1-context to G3 to T7 journey produces ranked, question and source groups with immutable export',async()=>{
  const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No network permitted');};
  try{const {api,db}=g2Harness({withAssessment:true});const run=await finishFixture(api);
    assert.equal(run.status,'complete',JSON.stringify(run.issues));assert.equal(run.ledger_status,'verified');assert.equal(run.export_status,'verified');
    assert.equal(run.candidates.length,6);assert.equal(run.ranking.ranked.length,3);assert.equal(run.ranking.needs_information.length,2);assert.equal(run.ranking.source_queue.length,1);
    assert.equal(db.questions.length,2);assert.equal(run.assessment_counters.recommendation_calls,6);
    assert.equal(run.candidates.find(c=>c.posting.job_id==='MAPLE').assessment.eligibility,'conflict');
    for(const c of run.candidates){assert.ok(c.assessment.model_calls<=6);assert.ok(c.assessment.tool_calls<=6);assert.equal(c.recommendation.advisory_only,true);}
    const before=structuredClone(run.candidates),question=db.questions[0],input={questionId:question.id,requestKey:crypto.randomUUID(),expectedVersion:1,responseKind:'unavailable',answer:'I do not know yet.'};
    assert.equal((await api.answer_validation_question('student-b',input)).status,404);
    const saved=await (await api.answer_validation_question('student-a',input)).json();assert.equal(saved.ok,true);assert.equal(db.responses.length,1);
    assert.equal((await api.answer_validation_question('student-a',input)).status,409);
    const q=db.questions[0];await api.answer_validation_question('student-a',{...input,requestKey:crypto.randomUUID(),expectedVersion:q.version_number,responseKind:'answer',answer:'I used the tool in a class project.'});assert.equal(db.responses.length,2);
    const refreshed=await (await api.list_discoveries('student-a',{runId:run.id})).json();assert.deepEqual(refreshed.runs[0].candidates,before);
  }finally{globalThis.fetch=old;}
});
test('legacy string-encoded ledger history excludes unchanged postings without reassessment',async()=>{
  const {api,db}=g2Harness({withAssessment:true});
  const first=await finishFixture(api);assert.equal(first.status,'complete');
  for(const row of db.ledger)row.record=JSON.stringify(row.record);
  const second=await finishFixture(api);
  assert.equal(second.status,'complete',JSON.stringify(second.issues));
  assert.equal(second.candidates.length,6);
  assert.ok(second.candidates.every(c=>c.disposition==='excluded_unchanged'));
  assert.equal(second.assessment_counters.model_calls,0);
  assert.equal(second.assessment_counters.recommendation_calls,0);
  assert.equal(db.questions.length,2);
  assert.ok(db.ledger.filter(r=>r.run_id===second.id).every(r=>r.version_number===2));
  assert.equal(second.export_row_count,12);
});

test('inference failure stops remaining assessments and still logs every discovered lead',async()=>{
  let calls=0;const {api,db}=g2Harness({withAssessment:true,keyPresent:true,modelFetcher:async()=>{calls++;return new Response('',{status:503});}});
  let data=await (await api.start_discovery('a',{requestKey:crypto.randomUUID(),mode:'synthetic'})).json();
  while(data.run.stage!=='assess'){data=await (await api.step_discovery('a',{runId:data.run.id,expectedRevision:data.run.revision})).json();}
  db.runs[0].state.mode='live';
  for(let i=0;data.run.status==='running'&&i<10;i++)data=await (await api.step_discovery('a',{runId:data.run.id,expectedRevision:data.run.revision})).json();
  assert.equal(calls,1);assert.equal(data.run.status,'operationally_incomplete');assert.equal(db.ledger.length,6);assert.equal(data.run.candidates.filter(c=>c.assessment_status==='not_processed').length,5);assert.equal(data.run.candidates[0].assessment.score.rated,false);
});
test('recommendation failure retains the completed score and marks later candidates not processed',async()=>{
  let calls=0;const {api,db}=g2Harness({withAssessment:true,keyPresent:true,modelFetcher:async()=>{calls++;return new Response('',{status:503});}});
  let data=await (await api.start_discovery('a',{requestKey:crypto.randomUUID(),mode:'synthetic'})).json();
  for(let n=0;n<35&&db.runs[0].state.g3?.task?.phase!=='recommendation';n++)data=await (await api.step_discovery('a',{runId:data.run.id,expectedRevision:data.run.revision})).json();
  db.runs[0].state.mode='live';
  for(let n=0;n<8&&data.run.status==='running';n++)data=await (await api.step_discovery('a',{runId:data.run.id,expectedRevision:data.run.revision})).json();
  assert.equal(calls,1);assert.equal(data.run.candidates[0].assessment.score.label,'5/5');assert.equal(data.run.candidates[0].recommendation_status,'failed');assert.equal(data.run.status,'operationally_incomplete');assert.equal(data.run.ranking.ranked.length,0);
});

test('approved GPT configuration reuses one supplied key and pins T4 and T5',()=>{
  const model=createG3({apiKey:'synthetic-never-sent'}),state={mode:'live'};
  model.initialize(state,G3_FIXTURE_CONTEXT);
  assert.equal(model.configured,true);
  assert.deepEqual(state.g3.configuration,{assessmentModel:'gpt-5.6-luna',recommendationModel:'gpt-5.6-luna',reasoning:'none'});
});
test('explicit hours, pay, location and authorization are compared without relaxing constraints',()=>{
  const t=task(),context=structuredClone(G3_FIXTURE_CONTEXT),p=t.bundle.posting;
  context.scope.optional_facts={available_hours_per_week:20,available_locations:['Seattle, WA, US'],remote_available:true,authorized_to_work_us:false,minimum_hourly_pay:{amount:25,currency:'USD'}};
  p.work_hours='30–40 hours per week';p.remote=true;
  p.compensation=JSON.stringify({currency:'USD',value:{minValue:18,maxValue:22,unitText:'HOUR'}});
  p.evidence.push({id:'posting:authorization',text:'Applicants must be legally authorized to work in the United States.'});
  const bundle=g3Evidence({candidate_id:'x',posting:p,disposition:'verified_new'},context),findings=g3Constraints(bundle);
  const status=field=>findings.find(c=>c.field===field).status;
  assert.equal(status('hours'),'conflict');assert.equal(status('compensation'),'conflict');assert.equal(status('work_authorization'),'conflict');assert.equal(status('location'),'matched');assert.equal(status('work_arrangement'),'matched');
  context.scope.optional_facts.available_hours_per_week=35;context.scope.optional_facts.minimum_hourly_pay.currency='CAD';
  const uncertain=g3Constraints(g3Evidence({candidate_id:'x',posting:p,disposition:'verified_new'},context));
  assert.equal(uncertain.find(c=>c.field==='hours').status,'unknown');assert.equal(uncertain.find(c=>c.field==='compensation').status,'unknown');
});
test('unrecognized constraints and impossible dates stay unknown; invalid setup values cannot be saved',()=>{
  const t=task();t.bundle.posting.deadline='2027-02-30';t.bundle.posting.work_hours='up to 40 hours';
  assert.equal(g3Constraints(t.bundle).find(c=>c.field==='deadline').status,'unknown');assert.equal(g3Constraints(t.bundle).find(c=>c.field==='hours').status,'unknown');
  const input={startDate:'2027-06-01',endDate:'2027-11-30',roleTypes:['internship'],roleInterests:['Data analytics'],optionalFacts:{available_hours_per_week:169}};
  assert.equal(validateScope(input).code,'OPTIONAL_FACTS_INVALID');input.optionalFacts={authorized_to_work_us:'yes'};assert.equal(validateScope(input).ok,false);
  input.optionalFacts={available_hours_per_week:0,authorized_to_work_us:false};assert.equal(validateScope(input).ok,true);
});
test('a date answer validates the actual calendar and does not mutate history on rejection',async()=>{
  const {api,db}=g2Harness({withAssessment:true});await finishFixture(api);const q=db.questions[0];q.case_data.answer_type='date';
  const input={questionId:q.id,requestKey:crypto.randomUUID(),expectedVersion:1,responseKind:'answer',answer:'2027-02-30'};
  assert.equal((await api.answer_validation_question('student-a',input)).status,422);assert.equal(db.responses.length,0);
  input.answer='2027-02-28';assert.equal((await api.answer_validation_question('student-a',input)).status,200);assert.equal(db.responses.length,1);
});
test('a changed posting receives its own prior assessments and answered questions only',async()=>{
  const {api,db}=g2Harness({withAssessment:true});await finishFixture(api);
  const row=db.ledger.find(r=>r.record.posting?.job_id==='CEDAR');row.record.posting.description='An older description, before the material update.';
  const question=db.questions.find(q=>q.candidate_id===row.candidate_id);question.answer='I used R in a course project.';question.status='response_received';
  db.questions.push({...structuredClone(question),owner_id:'student-b',answer:'OTHER OWNER MUST NOT LEAK'});
  const next=await finishFixture(api),changed=next.candidates.find(c=>c.disposition==='verified_changed');
  assert.equal(changed.prior_history[0].id,row.id);assert.equal(changed.prior_history[0].assessment.score.label,'3–5/5 provisional');
  assert.equal(changed.prior_history[0].questions.length,1);assert.equal(changed.prior_history[0].questions[0].answer,'I used R in a course project.');
  assert.equal(JSON.stringify(changed).includes('OTHER OWNER MUST NOT LEAK'),false);
});

test('restated gaps use exact evidence identity; application availability cannot become schedule evidence',()=>{
  const t=task('CEDAR');g3ApplyStep(t,g3FixtureStep(t));g3ApplyStep(t,g3FixtureStep(t));
  const student=g3FixtureStep(t).gaps[0];
  const source={owner:'source',topic:'Work availability',need:'Find the weekly schedule',question:'Employer question',answer_type:'text',affects:['eligibility'],posting:[{id:'posting:availability',quote:'availability: unknown'}]};
  g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[student,source],summary:'Identify two issues'});
  assert.equal(t.gaps.length,2);assert.equal(t.gaps[1].target_id,'constraint:availability');
  assert.equal(t.gaps[1].topic,'Application availability');assert.match(t.gaps[1].need,/applications are still open/);assert.equal(t.gaps[1].question,null);
  assert.throws(()=>g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[{...source,topic:'Different name'}]}),/REPEAT_WITHOUT_NEW/);
  g3ApplyStep(t,{subtask:'Form Evidence-Backed Assessment',tool:'none',evidence_refs:[],criteria:[],gaps:[{...student,topic:'R experience clarification'},{...source,topic:'Application availability and schedule'}],summary:'Form from existing evidence'});
  assert.equal(t.assessment.status,'completed');assert.equal(t.assessment.gaps.length,2);assert.equal(t.assessment.score.label,'3–5/5 provisional');assert.equal(t.assessment.eligibility,'undetermined');
});

test('a third distinct gap stays blocked and does not mutate the two-gap ledger',()=>{
  const t=task('CEDAR');g3ApplyStep(t,g3FixtureStep(t));g3ApplyStep(t,g3FixtureStep(t));
  const student=g3FixtureStep(t).gaps[0],source={owner:'source',topic:'Posting availability',need:'Verify open applications',question:'',answer_type:'text',affects:['eligibility'],posting:[{id:'posting:availability',quote:'availability: unknown'}]};
  g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[student,source],summary:'Two issues'});
  const before=structuredClone(t.gaps),location={...student,topic:'Work location',need:'Confirm availability in Seattle',question:'Can you work in Seattle?',affects:['readiness'],posting:[{id:'posting:location',quote:'location: Seattle, WA, US'}]};
  assert.throws(()=>g3ApplyStep(t,{subtask:'Form Evidence-Backed Assessment',tool:'none',evidence_refs:[],criteria:[],gaps:[location]}),/MATERIAL_GAP_LIMIT/);
  assert.deepEqual(t.gaps,before);assert.equal(t.assessment,null);
});

test('independent unknown qualifications sharing one source record are not merged',()=>{
  const t=task('CEDAR');t.bundle.refs.find(r=>r.id==='posting:criterion:1').text+=' Rust programming required.';t.bundle.posting.requirements[0]+=' Rust programming required.';
  const compare=g3FixtureStep(t);for(const c of compare.criteria)c.posting[0].id='posting:criterion:1';
  const unknown=structuredClone(compare.criteria[1]);unknown.label='Rust programming';unknown.posting[0].quote='Rust programming required.';unknown.missing='No confirmed Rust comparison in this test';compare.criteria.push(unknown);
  g3ApplyStep(t,compare);g3ApplyStep(t,g3FixtureStep(t));
  const r=g3FixtureStep(t).gaps[0],rust={...r,topic:'Other tool',need:'Clarify Rust',question:'Have you used Rust?',posting:[{id:'posting:criterion:1',quote:'Rust programming required.'}]};
  g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[r,rust],summary:'Separate qualifications'});
  assert.equal(t.gaps.length,2);assert.deepEqual(t.gaps.map(g=>g.target_id),['criterion-2','criterion-3']);
});

test('retrieval leaves comparison pending; completing it keeps the same deadline and repeat budget',()=>{
  const t=task('CEDAR'),deadline=t.deadline_ms,comparison=g3FixtureStep(t),retrieve={...comparison,criteria:[]};
  assert.ok(g3NextSubtasks(t).includes('Evaluate Constraints'));assert.equal(g3NextSubtasks(t).includes('Form Evidence-Backed Assessment'),false);
  g3ReserveModel(t);g3ApplyStep(t,retrieve);
  assert.equal(t.pending_subtask,'Compare Requirements');assert.equal(t.subtasks.length,0);assert.equal(t.criteria.length,0);assert.equal(t.tool_calls,1);
  assert.deepEqual(g3StepSchema(t).properties.subtask.enum,['Compare Requirements']);assert.deepEqual(g3StepSchema(t).properties.tool.enum,['none']);
  assert.throws(()=>g3ApplyStep(t,{subtask:'Evaluate Constraints',tool:'check_explicit_constraints',criteria:[],gaps:[]}),/PENDING_SUBTASK_RESULT_REQUIRED/);
  assert.equal(t.tool_calls,1);
  g3ReserveModel(t);g3ApplyStep(t,{...comparison,tool:'none'});
  assert.equal(t.pending_subtask,null);assert.equal(t.subtasks.length,1);assert.equal(t.criteria.length,2);assert.equal(t.model_calls,2);assert.equal(t.deadline_ms,deadline);
  assert.throws(()=>g3ApplyStep(t,comparison),/REPEAT_WITHOUT_NEW/);
});

test('empty or omitted qualifications cannot mark Compare complete or consume a retrieval tool',()=>{
  const t=task('CEDAR'),comparison=g3FixtureStep(t);
  assert.throws(()=>g3ApplyStep(t,{...comparison,tool:'none',criteria:[]}),/POSTING_REQUIREMENT_NOT_CLASSIFIED/);
  assert.throws(()=>g3ApplyStep(t,{...comparison,criteria:comparison.criteria.slice(0,1)}),/POSTING_REQUIREMENT_NOT_CLASSIFIED/);
  assert.equal(t.criteria.length,0);assert.equal(t.subtasks.length,0);assert.equal(t.tool_calls,0);
});

test('a needed student question keeps Form unavailable and failed Form never appears complete',()=>{
  const t=task('CEDAR');g3ApplyStep(t,g3FixtureStep(t));g3ApplyStep(t,g3FixtureStep(t));
  assert.equal(g3StepSchema(t).properties.subtask.enum.includes('Form Evidence-Backed Assessment'),false);
  assert.throws(()=>g3ApplyStep(t,{subtask:'Form Evidence-Backed Assessment',tool:'none',criteria:[],gaps:[],summary:'Claimed completion'}),/STUDENT_FIT_QUESTION_REQUIRED/);
  assert.equal(t.subtasks.some(s=>s.name==='Form Evidence-Backed Assessment'),false);
  g3ApplyStep(t,g3FixtureStep(t));assert.ok(g3NextSubtasks(t).includes('Form Evidence-Backed Assessment'));
});

test('gap evidence retrieval also remains pending until its findings arrive',()=>{
  const t=task('CEDAR');g3ApplyStep(t,g3FixtureStep(t));g3ApplyStep(t,g3FixtureStep(t));
  const finding=g3FixtureStep(t);
  g3ApplyStep(t,{...finding,tool:'retrieve_supplied_evidence',evidence_refs:['posting:criterion:1'],gaps:[]});
  assert.equal(t.pending_subtask,'Examine Evidence Gaps');assert.equal(t.gaps.length,0);assert.equal(t.subtasks.length,2);
  g3ApplyStep(t,finding);assert.equal(t.pending_subtask,null);assert.equal(t.gaps.length,1);assert.equal(t.subtasks.length,3);
});

test('a second gap may retrieve evidence but must resolve to a distinct issue before completing',()=>{
  const t=task('CEDAR');g3ApplyStep(t,g3FixtureStep(t));g3ApplyStep(t,g3FixtureStep(t));
  const first=g3FixtureStep(t);g3ApplyStep(t,first);
  g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'retrieve_supplied_evidence',evidence_refs:['posting:availability'],criteria:[],gaps:[],summary:'Read another possible gap'});
  assert.equal(t.pending_subtask,'Examine Evidence Gaps');assert.equal(t.subtasks.length,3);
  assert.throws(()=>g3ApplyStep(t,first),/REPEAT_WITHOUT_NEW/);
  assert.equal(t.gaps.length,1);assert.equal(t.pending_subtask,'Examine Evidence Gaps');
  const availability={owner:'source',topic:'Application availability',need:'Confirm applications are open',question:'',answer_type:'text',affects:['eligibility'],posting:[{id:'posting:availability',quote:'availability: unknown'}]};
  g3ApplyStep(t,{subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[availability],summary:'Second distinct issue'});
  assert.equal(t.gaps.length,2);assert.equal(t.pending_subtask,null);assert.equal(t.subtasks.filter(s=>s.name==='Examine Evidence Gaps').length,2);
  assert.equal(g3NextSubtasks(t).includes('Examine Evidence Gaps'),false);
});

test('provider adapter carries pending retrieval into classification and preserves T4/T5 limits',async()=>{
  const fixture=task('CEDAR'),compare=g3FixtureStep(fixture);g3ApplyStep(fixture,compare);
  const constraints=g3FixtureStep(fixture);g3ApplyStep(fixture,constraints);
  const gap=g3FixtureStep(fixture).gaps[0];
  const replies=[{...compare,criteria:[]},{...compare,tool:'none',gaps:[gap]},constraints,
    {subtask:'Form Evidence-Backed Assessment',tool:'none',evidence_refs:[],criteria:[],gaps:[],summary:'Complete from ledger'},
    {action:'ask_student',reason:'R is unknown',next_step:'Answer the R coursework question.',evidence_ids:['gap:1'],history_id:null,suggestions:[]}];
  const requests=[];
  const engine=createG3({apiKey:'synthetic-not-sent',fetcher:async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');const request=JSON.parse(init.body);requests.push(request);
    const result=replies[requests.length-1];assert.ok(result,'No extra model request permitted');
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
  }});
  const s={mode:'live',scope:structuredClone(G3_FIXTURE_CONTEXT.scope),resume_version:5,results:[{candidate_id:'CEDAR',disposition:'verified_new',posting:fixture.bundle.posting}],issues:[],incomplete:false};
  engine.initialize(s,G3_FIXTURE_CONTEXT);engine.begin(s);
  for(let i=0;i<7&&s.stage==='assess';i++){engine.reserve(s);await engine.step(s);}
  assert.deepEqual(s.issues,[]);assert.equal(requests.length,5);assert.equal(s.g3.model_calls,4);assert.equal(s.g3.recommendation_calls,1);
  const second=JSON.parse(requests[1].input);assert.equal(second.pending_subtask,'Compare Requirements');assert.equal(second.completed_subtasks.length,0);assert.equal(second.tool_results.length,1);
  assert.deepEqual(requests[1].text.format.schema.properties.subtask.enum,['Compare Requirements']);assert.deepEqual(requests[1].text.format.schema.properties.tool.enum,['none']);
  assert.ok(requests.slice(0,4).every(r=>r.max_output_tokens===5500&&r.text.format.name==='next_assessment_subtask'));
  assert.equal(requests[4].max_output_tokens,1200);assert.equal(requests[4].text.format.name,'next_action');
  const adviceInput=JSON.parse(requests[4].input),citationSchema=requests[4].text.format.schema.properties.evidence_ids;
  assert.deepEqual(adviceInput.evidence_catalog,g3RecommendationEvidence(s.results[0].assessment));
  assert.deepEqual(citationSchema.items.enum,adviceInput.evidence_catalog.map(item=>item.id));assert.equal(citationSchema.minItems,1);
  assert.equal(adviceInput.evidence_catalog.find(item=>item.id==='gap:1').finding.question,gap.question);
  assert.equal(s.results[0].assessment.score.label,'3–5/5 provisional');assert.equal(s.results[0].recommendation.action,'ask_student');assert.equal(s.results[0].questions.length,1);
});

test('recommendation citations identify checked findings and reject invented or absent references',()=>{
  const t=task('CEDAR');for(let i=0;i<4;i++)g3ApplyStep(t,g3FixtureStep(t));
  const a=t.assessment,catalog=g3RecommendationEvidence(a);
  assert.equal(catalog.find(item=>item.id==='gap:1').finding.target_id,'criterion-2');
  assert.equal(catalog.find(item=>item.id==='criterion-2').finding.status,'unknown');
  const valid={action:'ask_student',reason:'R experience is unknown.',next_step:a.gaps[0].question,evidence_ids:['criterion-2','gap:1'],history_id:null,suggestions:[]};
  assert.equal(g3CheckRecommendation(valid,a).status,'completed');
  const allowed=g3RecommendationSchema(a).properties.evidence_ids.items.enum;
  for(const invalid of [[],['gap:student:R programming'],['gap:2'],['criterion-99'],['constraint:nonexistent']]){
    assert.throws(()=>g3CheckRecommendation({...valid,evidence_ids:invalid},a),/RECOMMENDATION_EVIDENCE_REQUIRED/);
    for(const id of invalid)assert.equal(allowed.includes(id),false);
  }
  assert.throws(()=>g3RecommendationSchema({criteria:[],constraints:[],gaps:[]}),/RECOMMENDATION_EVIDENCE_REQUIRED/);
});
