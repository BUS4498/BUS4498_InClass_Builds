// Fictional assessment fixtures, never substituted into live results.
export const G3_FIXTURE_CONTEXT = {
  resume:{id:'00000000-0000-4000-8000-000000000002',version_number:5,student_correction:'',confirmed_passage_ids:['1','2','3','4'],
    extracted_passages:[
      {id:'1',reference:'synthetic paragraph 1',text:'SYNTHETIC STUDENT. BS Information Systems, expected May 2027.'},
      {id:'2',reference:'synthetic paragraph 2',text:'Course project: used Excel pivot tables and SQL joins to analyze service data.'},
      {id:'3',reference:'synthetic paragraph 3',text:'Course project: introductory Python data cleaning; no professional Python experience.'},
      {id:'4',reference:'synthetic paragraph 4',text:'Student confirms no Tableau experience.'}]},
  scope:{id:'00000000-0000-4000-8000-000000000001',version_number:1,start_date:'2027-06-01',end_date:'2027-11-30',role_types:['internship','entry-level'],role_interests:['data analytics','data operations'],location_preference:'Seattle or remote',hard_constraints:[],optional_facts:{}},history:[]
};
const g3FixtureSpecs = [
  ['BEACON','Beacon Civic Data','Excel coursework required.','2026-09-20'],
  ['CEDAR','Cedar Research Lab','Excel coursework required. R programming required.','2026-09-19'],
  ['SUMMIT','Summit Community Analytics','SQL coursework required. Power BI preferred.','2026-09-18'],
  ['HARBOR','Harbor Public Insights','Excel coursework required. Additional technical credentials may be needed.','2026-09-17'],
  ['BIRCH','Birch Service Analytics','Excel coursework required. Python coursework preferred.','2026-09-16'],
  ['MAPLE','Maple Data Cooperative','Excel coursework required. Tableau experience required.','2026-09-15']
];
export function g3FixtureSearch(item){
  return {sources:item.name==='Employer career sites'?g3FixtureSpecs.map(([id,name])=>({url:`https://careers.synthetic.example/jobs/${id}`,title:`${name} Data Analytics Intern`})):[],queries:[item.intent],observed:0};
}
export function g3FixturePage(url){
  const [id,name,qualifications,datePosted]=g3FixtureSpecs.find(r=>url.endsWith(r[0]))||[];
  if(!id)return {status:404,text:''};
  const job={'@context':'https://schema.org','@type':'JobPosting',url,title:'Data Analytics Intern',hiringOrganization:{name},identifier:{value:id},description:`SYNTHETIC TEST POSTING. Data analytics and data operations internship for summer 2027. ${qualifications}`,qualifications,
    jobStartDate:'2027-06-15',datePosted,validThrough:'2027-03-01',jobLocation:{address:{addressLocality:'Seattle',addressRegion:'WA',addressCountry:'US'}}};
  return {status:200,text:`<!doctype html><script type="application/ld+json">${JSON.stringify(job)}</script>`};
}
const g3FixtureCite=(bundle,kind,phrase)=>{
  const ref=bundle.refs.find(r=>(kind==='posting'?r.kind==='posting':r.kind==='student')&&r.text.includes(phrase));
  if(!ref)throw Error('FIXTURE_REFERENCE_MISSING');return [{id:ref.id,quote:phrase}];
};
function g3FixtureCriteria(bundle){
  const id=bundle.posting.job_id,excel='Excel coursework required.',sql='SQL coursework required.';
  const phrase=id==='SUMMIT'?sql:excel;
  const out=[{label:id==='SUMMIT'?'SQL coursework':'Excel coursework',type:'required',status:'matched',basis:'coursework',
    posting:g3FixtureCite(bundle,'posting',phrase),student:g3FixtureCite(bundle,'student','Course project: used Excel pivot tables and SQL joins to analyze service data.'),missing:'',unknown_owner:'student',explanation:'The posting accepts coursework, and the confirmed course project names the requested tools.'}];
  const unknown=(label,type,phrase,owner)=>out.push({label,type,status:'unknown',basis:'unknown',posting:g3FixtureCite(bundle,'posting',phrase),student:[],missing:owner==='student'?`No confirmed evidence about ${label}.`:'The posting does not identify the additional credential or its requiredness.',unknown_owner:owner,explanation:'Missing evidence remains unknown and contributes a range, not a zero-skill judgment.'});
  if(id==='CEDAR'){
    const phrase=['Synthetic clarification: I used R programming in a course project to clean survey data.','SYNTHETIC TEST: I used R to summarize a class dataset. I have no professional R experience.'].find(text=>bundle.refs.some(r=>r.id.startsWith('student:clarification:')&&r.text.includes(text)));
    if(phrase)out.push({label:'R programming',type:'required',status:'matched',basis:'coursework',posting:g3FixtureCite(bundle,'posting','R programming required.'),student:g3FixtureCite(bundle,'student',phrase),missing:'',unknown_owner:'student',explanation:'The saved student clarification supplies a specific course-project example.'});
    else unknown('R programming','required','R programming required.','student');
  }
  if(id==='SUMMIT')unknown('Power BI','preferred','Power BI preferred.','student');
  if(id==='HARBOR')unknown('Additional technical credentials','unclear','Additional technical credentials may be needed.','source');
  if(id==='BIRCH')out.push({label:'Python coursework',type:'preferred',status:'matched',basis:'coursework',posting:g3FixtureCite(bundle,'posting','Python coursework preferred.'),student:g3FixtureCite(bundle,'student','Course project: introductory Python data cleaning; no professional Python experience.'),missing:'',unknown_owner:'student',explanation:'Introductory coursework supports the stated coursework preference; professional experience is not claimed.'});
  if(id==='MAPLE')out.push({label:'Tableau experience',type:'required',status:'documented_gap',basis:'explicit_absence',posting:g3FixtureCite(bundle,'posting','Tableau experience required.'),student:g3FixtureCite(bundle,'student','Student confirms no Tableau experience.'),missing:'',unknown_owner:'student',explanation:'The student explicitly confirms absence; this is a documented gap rather than an inference from an omission.'});
  return out;
}
export function g3FixtureStep(task){
  const bundle=task.bundle,id=bundle.posting.job_id;
  if(bundle.clarification?.length&&!task.subtasks.some(s=>s.name==='Incorporate Student Clarification'))return {subtask:'Incorporate Student Clarification',tool:'none',evidence_refs:bundle.refs.filter(r=>r.id.startsWith('student:clarification:')).map(r=>r.id),criteria:[],gaps:[],summary:'Read only the saved responses associated with this target. Original assessments remain unchanged.'};
  if(!task.subtasks.some(s=>s.name==='Compare Requirements'))return {subtask:'Compare Requirements',tool:'retrieve_supplied_evidence',evidence_refs:bundle.refs.filter(r=>['posting','student'].includes(r.kind)).map(r=>r.id),criteria:g3FixtureCriteria(bundle),gaps:[],summary:'Compare the fictional posting qualifications with confirmed course evidence.'};
  if(!task.constraints)return {subtask:'Evaluate Constraints',tool:'check_explicit_constraints',evidence_refs:[],criteria:[],gaps:[],summary:'Check explicit dates and leave absent eligibility and work-mode facts unknown.'};
  if(['CEDAR','SUMMIT','HARBOR'].includes(id)&&!task.gaps.length&&task.criteria.some(c=>c.status==='unknown')){
    const criterion=task.criteria.find(c=>c.status==='unknown'),owner=criterion.unknown_owner;
    return {subtask:'Examine Evidence Gaps',tool:'none',evidence_refs:[],criteria:[],gaps:[{owner,topic:criterion.label,need:criterion.missing,question:owner==='student'?`Have you used ${id==='CEDAR'?'R programming':'Power BI'} in coursework, a project, or work? Give a short example, or say you do not know.`:'',answer_type:'text',affects:['fit'],posting:criterion.posting.map(e=>({id:e.id,quote:e.quote}))}],summary:'Identify the specific evidence that could change the assessment.'};
  }
  return {subtask:'Form Evidence-Backed Assessment',tool:'none',evidence_refs:[],criteria:[],gaps:[],summary:'Form a score using the checked criterion ledger; keep eligibility separate.'};
}
export function g3FixtureRecommendation(assessment){
  const action=assessment.eligibility==='conflict'?'archive':assessment.gaps.some(g=>g.owner==='student')?'ask_student':'monitor';
  return {action,reason:action==='archive'?'An explicitly confirmed required qualification is not met.':action==='ask_student'?'One student fact could materially change the score.':'Verify the missing posting facts before deciding whether to apply.',
    next_step:action==='ask_student'?'Answer the specific question shown for this posting.':action==='archive'?'Review the documented gap and decide whether to keep or archive this opportunity.':'Check the employer posting for current availability, then review your application plans.',
    evidence_ids:action==='archive'?['criterion-2']:action==='ask_student'?['gap:1']:['constraint:availability'],history_id:null,
    suggestions:[{type:'resume_tailoring',reason:'Highlight the confirmed course project that matches this role.'},{type:'cover_letter',reason:'Connect the confirmed project to the stated duties.'},{type:'interview_cards',reason:'Practice explaining the cited project and the limits of your experience.'}]};
}
