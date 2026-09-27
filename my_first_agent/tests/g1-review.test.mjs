import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeSummary,validateResumeReview,resetStudentSetup} from '../supabase/functions/_shared/g1-review.mjs';
import {g3Evidence} from '../supabase/functions/_shared/g3-domain.mjs';
import worker from '../app/worker/index.mjs';
const passages=[{id:'1',text:'EDUCATION',reference:'line 1'},{id:'2',text:'B.S. Information Systems, May 2028',reference:'line 2'},{id:'3',text:'SKILLS',reference:'line 3'},{id:'4',text:'SQL and Microsoft Excel',reference:'line 4'},{id:'5',text:'maya@example.com',reference:'line 5'}];
test('summary is a bounded source-derived draft without invented qualifications or contact details',()=>{
 const result=resumeSummary(passages);assert.match(result.text,/B.S. Information Systems/);assert.match(result.text,/SQL and Microsoft Excel/);assert.doesNotMatch(result.text,/@|Python/);assert.ok(result.text.length<2300);assert.ok(result.sources.every(p=>passages.some(x=>x.id===p.id&&x.text===p.text)));
});
test('confirmation uses the edited text and never silently confirms original passages',()=>{
 assert.equal(validateResumeReview({text:'I have studied SQL in a course.',confirmed:false},passages).ok,false);
 assert.equal(validateResumeReview({text:'x'.repeat(6001),confirmed:true},passages).ok,false);
 const r=validateResumeReview({text:'I have studied SQL in a course.',confirmed:true},passages);
 assert.equal(r.review.text,'I have studied SQL in a course.');assert.notEqual(r.review.generated_text,r.review.text);assert.equal(r.confirmedIds,undefined);
 const evidence=g3Evidence({disposition:'verified_new',posting:{url:'https://example.com/job',evidence:[],requirements:[]}},{resume:{version_number:5,extracted_passages:passages,confirmed_passage_ids:['4'],student_correction:'I know Excel',confirmed_summary:r.review.text,summary_scope_version:6},scope:{version_number:6,role_interests:[],optional_facts:{}}});
 assert.ok(evidence.refs.some(e=>e.text===r.review.text));assert.ok(!evidence.refs.some(e=>e.text==='SQL and Microsoft Excel'||e.text==='I know Excel'));
});
function resetHarness(){
 const owners=new Map([['a',{setup_revision:2,setup_reset_at:null}],['b',{setup_revision:7,setup_reset_at:null}]]),queries=[];let active=false;
 async function sql(parts,...v){const q=parts.join('?').replace(/\s+/g,' ');queries.push(q);if(q.includes('pg_advisory'))return [];
  if(q.startsWith('select setup_revision')){const r=owners.get(v[0]);return r?[{...r}]:[];}
  if(q.includes('from career_prep.discovery_runs'))return active?[{id:'running'}]:[];
  if(q.startsWith('update career_prep.owners')){const r=owners.get(v[0]);r.setup_revision++;r.setup_reset_at='2026-09-27T00:00:00Z';return [{...r}];}throw Error(q);}
 sql.begin=fn=>fn(sql);return {sql,owners,queries,setActive:()=>{active=true;},reply:(v,s=200)=>Response.json(v,{status:s})};
}
test('reset is owner-scoped, preserves historical tables, and rejects replay from an old tab',async()=>{
 const h=resetHarness(),p={confirm:true,expectedWorkspaceVersion:2,owner_id:'b'};
 assert.equal((await resetStudentSetup(h,'a',p)).status,200);assert.equal(h.owners.get('a').setup_revision,3);assert.equal(h.owners.get('b').setup_revision,7);
 assert.equal((await resetStudentSetup(h,'a',p)).status,409);assert.ok(h.queries.every(q=>!/(delete|truncate|drop)/i.test(q)));
});
test('reset refuses an active run and requires the explicit confirmation flag',async()=>{
 const h=resetHarness();assert.equal((await resetStudentSetup(h,'a',{expectedWorkspaceVersion:2})).status,422);h.setActive();assert.equal((await resetStudentSetup(h,'a',{confirm:true,expectedWorkspaceVersion:2})).status,409);assert.equal(h.owners.get('a').setup_revision,2);
});
test('all four page URLs, including deep links, serve the application without redirecting APIs',async()=>{
 const env={ASSETS:{fetch:async req=>new Response(new URL(req.url).pathname)}};
 for(const page of ['setup','opportunities','preparation','schedule'])assert.equal(await (await worker.fetch(new Request(`https://test.example/${page}/`),env)).text(),'/');
 const denied=await worker.fetch(new Request('https://test.example/api/g1/reset',{method:'POST'}),env);assert.equal(denied.status,401);
});
