import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {g3Criteria,g3CheckCoverage} from '../supabase/functions/_shared/g3-domain.mjs';
import {g3QualifierSupport,g3QualificationCatalog} from '../supabase/functions/_shared/g3-qualifications.mjs';

const source='MANDATORY QUALIFICATION CRITERIA: 1. Experience explaining analytics to a group 2. Experience gathering data to solve problems PREFERRED QUALIFICATIONS: Experience using Python ADDITIONAL INFORMATION: Our team supports operations. Applicants must upload a transcript.';
const bundle={refs:[{id:'posting:criterion:1',kind:'posting',text:source,reference:'Fictional posting',verified:true},{id:'student:summary',kind:'student',text:'I gathered data in a class project.',reference:'Synthetic confirmed summary',verified:true}],posting:{requirements:[source],description:''}};
function criterion(quote,type='required'){return {label:quote,type,status:'unknown',basis:'unknown',posting:[{id:'posting:criterion:1',quote}],student:[],missing:'Relevant student experience is not confirmed.',unknown_owner:'student',explanation:'Specific experience needs confirmation.'};}
test('a short qualification inherits its exact mandatory heading, without requiring the model to repeat the whole list',()=>{
 const c=g3Criteria([criterion('Experience explaining analytics to a group')],bundle)[0];
 assert.equal(c.type,'required');assert.equal(c.weight,2);assert.equal(c.qualifier_context[0].quote,'MANDATORY QUALIFICATION CRITERIA:');
});
test('heading scope stops before preferences and background; unsupported classifications retain source uncertainty',()=>{
 assert.equal(g3QualifierSupport({id:'posting:criterion:1',quote:'Experience using Python'},bundle).type,'preferred');
 const c=g3Criteria([criterion('Experience using Python')],bundle)[0];assert.equal(c.type,'unclear');assert.equal(c.status,'unknown');assert.equal(c.unknown_owner,'source');
 assert.equal(g3QualifierSupport({id:'posting:criterion:1',quote:'Our team supports operations.'},bundle).type,'unclear');
 const bad=criterion('Invented requirement');assert.throws(()=>g3Criteria([bad],bundle),/UNSUPPORTED_EVIDENCE_REFERENCE/);
});
test('negated requirements cannot acquire mandatory weight as a match',()=>{
 const b=structuredClone(bundle);b.refs[0].text='REQUIREMENTS: Python is not required.';
 const c=g3Criteria([criterion('Python is not required.')],b)[0];assert.equal(c.type,'unclear');assert.equal(c.earned_lower,0);
});
test('numbered qualifications remain separate coverage obligations while background prose is excluded',()=>{
 const units=g3QualificationCatalog(bundle);assert.equal(units.length,4);assert.ok(!units.some(u=>u.quote.includes('Our team')));
 const criteria=g3Criteria(units.map(u=>criterion(u.quote,u.type)),bundle);
 assert.equal(g3CheckCoverage(criteria,bundle),true);
 assert.throws(()=>g3CheckCoverage(criteria.slice(1),bundle),/NOT_CLASSIFIED/);
});
test('a repeated basic enrollment sentence is covered without hiding a new enrollment condition',()=>{
 const b=structuredClone(bundle);b.refs[0].text='Incumbent must be enrolled in an associate degree program, baccalaureate, or graduate program.';
 b.refs.push({id:'posting:description',kind:'posting',text:'They must be in attendance at and enrolled in a graduate, baccalaureate, or associate',reference:'Fictional description',verified:true});
 const criteria=g3Criteria([criterion(b.refs[0].text)],b);assert.equal(g3CheckCoverage(criteria,b),true);
 b.refs[2].text+=' with at least 2 years remaining';assert.throws(()=>g3CheckCoverage(criteria,b),/NOT_CLASSIFIED/);
});
test('optional transcript guidance and repeated GPA consequences do not add qualifications; a different threshold does',()=>{
 const b=structuredClone(bundle);b.refs[0].text='REQUIREMENTS: Freshmen are required to achieve a fall semester GPA of 3.0 or higher. Freshmen may provide a letter of enrollment in place of a transcript. Applicants who do not meet the 3.0 GPA requirement in the fall semester will have their offers rescinded.';
 assert.equal(g3QualificationCatalog(b).length,1);
 b.refs[0].text=b.refs[0].text.replace('do not meet the 3.0','do not meet the 3.5');assert.equal(g3QualificationCatalog(b).length,2);
});
test('a claimed full match that names missing evidence stays unknown',()=>{
 const c=criterion('Experience gathering data to solve problems');Object.assign(c,{status:'matched',basis:'project',student:[{id:'student:summary',quote:'I gathered data in a class project.'}],missing:'The specific problem and outcome are unconfirmed.'});
 const result=g3Criteria([c],bundle)[0];assert.equal(result.status,'unknown');assert.equal(result.earned_lower,0);assert.equal(result.unknown_owner,'student');
});
test('analysis alone does not establish data collection experience',()=>{
 const b=structuredClone(bundle);b.refs[1].text='I analyzed a supplied dataset in a class project.';
 const c=criterion('Experience gathering data to solve problems');Object.assign(c,{status:'matched',basis:'coursework',student:[{id:'student:summary',quote:b.refs[1].text}],missing:''});
 assert.equal(g3Criteria([c],b)[0].status,'unknown');
});
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../app/static/search-progress.js',import.meta.url),'utf8'),context);const describe=context.window.CareerSearchProgress.describe;
test('a logged run with no eligible posting labels assessment as skipped, including targeted preparation',()=>{
 const run={status:'complete',stage:'done',trigger:'targeted_update',counters:{reads:1},assessment_counters:{model_calls:0},assessment_progress:{total:0,completed:0},candidates:[{disposition:'excluded_timeframe_unknown'}],ledger_status:'verified',export_status:'verified'};
 const p=describe(run);assert.equal(p.percent,100);assert.match(p.title,/no assessments/);assert.equal(p.skipped.filter(Boolean).length,2);assert.equal(p.stages.some(([s])=>s==='search'),false);assert.match(p.detail,/No new assessment/);
});
test('progress uses confirmed stages and actual counts; failed assessment is never shown as 100 percent complete',()=>{
 const run={status:'running',stage:'assess',counters:{api_attempts:5,leads:40,reads:12},assessment_counters:{model_calls:2},assessment_progress:{total:4,completed:1,role:'Synthetic analyst'},candidates:[]};
 const p=describe(run);assert.equal(p.percent,50);assert.match(p.detail,/1 of 4 postings assessed/);assert.match(p.detail,/2 assessment requests/);
 const failure=describe({...run,status:'operationally_incomplete',stage:'done',failure_stage:'assess',ledger_status:'verified',export_status:'verified'});
 assert.equal(failure.percent,83);assert.equal(failure.title,'Run needs attention');assert.equal(failure.running,false);
 const success=describe({...run,status:'complete',stage:'done',ledger_status:'verified',export_status:'verified'});assert.equal(success.percent,100);
});
