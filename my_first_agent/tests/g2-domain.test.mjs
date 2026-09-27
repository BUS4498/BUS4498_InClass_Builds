import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { G2_SOURCES,g2NewState,g2Reserve,g2AddLeads,g2SearchSources,g2Authority,g2PostingUrl,g2ParsePosting,g2Validate,g2Material } from '../supabase/functions/_shared/g2-domain.mjs';
import { g2FixturePage,g2FixtureSearch } from '../supabase/functions/_shared/g2-fixtures.mjs';
import { g2Workbook,g2WorkbookManifest } from '../supabase/functions/_shared/g2-workbook.mjs';
const registry=await readFile(new URL('../docs/references/job-search-sources.txt',import.meta.url),'utf8');
const time='2026-09-27T12:00:00.000Z';
const scope={version_number:1,start_date:'2027-06-01',end_date:'2027-11-30',role_types:['internship','entry-level'],role_interests:['data analytics','data operations'],hard_constraints:[]};
const fresh=()=>g2NewState({id:'fixture-run',scope,registryText:registry,mode:'synthetic',now:time});
const employerUrl='https://careers.northstar-civic.example/jobs/NCD-271';
const parsed=(url=employerUrl)=>g2ParsePosting(g2FixturePage(url).text,url,'synthetic employer',time).posting;
const lead=(p=parsed())=>({candidate_id:'c1',source:'Employer career sites',source_order:7,url:p.url,access:'readable',posting:p});

test('fixed registry plan has all eight sources, student timeframe/types, and explicit skips',()=>{
 const s=fresh();assert.deepEqual(s.plan.map(p=>p.name),G2_SOURCES.map(p=>p.name));assert.equal(s.plan.filter(p=>p.skip).length,3);
 assert.match(s.plan[0].intent,/2027/);assert.throws(()=>g2NewState({id:'x',scope,registryText:'',mode:'live',now:time}),/REGISTRY/);
 assert.throws(()=>g2NewState({id:'x',scope:{...scope,role_interests:['email@example.com']},registryText:registry,mode:'live',now:time}),/TERMS/);
});
test('requests and direct reads are reserved before use, with hard caps and deadline',()=>{
 const s=fresh();g2Reserve(s,'search',Date.parse(time));assert.equal(s.counters.api_attempts,1);assert.equal(s.cursor,1);
 s.counters.api_attempts=8;assert.throws(()=>g2Reserve(s,'search',Date.parse(time)),/REQUEST_CAP/);
 s.counters.reads=24;assert.throws(()=>g2Reserve(s,'read',Date.parse(time)),/READ_CAP/);
 assert.throws(()=>g2Reserve(fresh(),'search',Date.parse(time)+480000),/DEADLINE/);
});
test('only completed tool sources count; generated prose and missing provider queries do not become evidence',()=>{
 const r={status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{url:'https://indeed.com/viewjob?jk=1'}]}},{type:'message',content:'invented job link'}]};
 assert.equal(g2SearchSources(r).queries,null);assert.equal(g2SearchSources(r).sources.length,1);
 assert.throws(()=>g2SearchSources({...r,output:[...r.output,r.output[0]]}),/UNEXPECTED/);
 assert.throws(()=>g2SearchSources({...r,status:'incomplete'}),/INCOMPLETE/);
 assert.throws(()=>g2SearchSources({status:'completed',output:[{...r.output[0],action:{type:'open_page'}}]}),/UNEXPECTED/);
});
test('lead cap, normalized link duplicates, and domain mismatches remain explicit',()=>{
 const s=fresh(),item=s.plan[0];s.mode='live';g2AddLeads(s,item,{observed:1,queries:null,sources:[{url:'https://evil.example/job',title:'outside'},...Array.from({length:45},(_,i)=>({url:`https://indeed.com/viewjob?jk=${i}`,title:'lead'}))]},time);
 assert.equal(s.leads.length,40);assert.equal(s.stopping_reason,'lead cap');assert.equal(s.leads[0].access,'unverified');
 const d=fresh();g2AddLeads(d,d.plan[0],{observed:1,queries:null,sources:[{url:'https://indeed.com/viewjob?jk=1&utm_source=xx'},{url:'https://indeed.com/viewjob?jk=1'}]},time);assert.equal(d.leads.length,1);
});
test('direct-read allowlist refuses internal, credential-bearing and secondary URLs',()=>{
 for(const u of ['https://localhost/x','http://jobs.lever.co/a/b','https://jobs.lever.co.evil.example/a/b','https://x:y@jobs.lever.co/a/b','https://127.0.0.1/a','https://indeed.com/viewjob?jk=1'])assert.equal(g2Authority(u),null);
 assert.equal(g2Authority('https://jobs.lever.co/company/job-id'),'employer ATS');
 assert.equal(g2Authority('https://www.usajobs.gov/job/view/12345'),'official USAJOBS');
 assert.equal(g2Authority('https://www.usajobs.gov/job/882600900'),'official USAJOBS');
});
test('search category pages and help PDFs cannot consume the job-lead allowance',()=>{
 const s=fresh();s.mode='live';
 const refs=['https://www.indeed.com/q-entry-level-data-analyst-internship-jobs.html','https://www.indeed.com/q-data-analyst-entry-level-internship-jobs.html'];
 g2AddLeads(s,s.plan[0],{observed:1,queries:null,sources:refs.map(url=>({url}))},time);
 assert.equal(s.leads.length,0);assert.equal(s.plan[0].non_posting_references,2);
 assert.equal(g2PostingUrl('https://www.usajobs.gov/EarlyCareers','USAJOBS'),false);
 assert.equal(g2PostingUrl('https://www.usajobs.gov/job/882600900','USAJOBS'),true);
 assert.equal(g2PostingUrl('https://simplify.jobs/p/d96c7046-d27a-4556-802b-4ae6a576f5e4/Marketing--Operations-Analytics-Co-op','Simplify Jobs'),true);
});
test('structured evidence must match exactly one posting and checked URL',()=>{
 const html=g2FixturePage(employerUrl).text;assert.equal(g2ParsePosting(html,employerUrl,'employer ATS',time).ok,true);
 assert.equal(g2ParsePosting(html,employerUrl+'wrong','employer ATS',time).ok,false);
 assert.equal(g2ParsePosting(html+html,employerUrl,'employer ATS',time).ok,false);
 assert.equal(g2ParsePosting('<h1>Apply now</h1>',employerUrl,'employer ATS',time).ok,false);
});
test('closed, missing timeframe, out-of-range, restricted, and unprocessed leads cannot be admitted',()=>{
 assert.equal(g2Validate(lead(parsed(employerUrl.replace('NCD-271','NCD-CLOSED'))),scope).disposition,'excluded_closed');
 const p=parsed();p.start_date=null;p.role='Data Operations Intern';p.description='Company founded 2027. Use SQL.';
 assert.equal(g2Validate(lead(p),scope).disposition,'excluded_timeframe_unknown');
 p.start_date='2028-06-15';assert.equal(g2Validate(lead(p),scope).disposition,'excluded_timeframe');
 assert.equal(g2Validate({...lead(),access:'restricted'},scope).disposition,'excluded_unverified');
 assert.equal(g2Validate({...lead(),access:'pending'},scope).disposition,'not_processed');
});
test('initial verification keeps unknown open status and does not invent fit, eligibility, or readiness',()=>{
 const r=g2Validate(lead(),scope);assert.equal(r.disposition,'verified_new');assert.equal(r.fit_score,null);assert.equal(r.eligibility,'Not assessed');assert.match(r.unknowns.join(' '),/open status/);
});
test('unchanged, materially changed, distinct-ID, and ambiguous-ID branches remain separate',()=>{
 const p=parsed(),prior={...lead(p),opportunity_id:'op_saved'};
 assert.equal(g2Validate(lead({...p,description:p.description+'  '}),scope,[prior]).disposition,'excluded_unchanged');
 assert.equal(g2Validate(lead({...p,description:p.description+' Must be available weekends.'}),scope,[prior]).disposition,'verified_changed');
 assert.equal(g2Validate(lead({...p,url:p.url+'B',job_id:'separate'}),scope,[prior]).disposition,'verified_new');
 const held=g2Validate(lead({...p,url:p.url+'B',job_id:null}),scope,[prior]);assert.equal(held.disposition,'held_validation');assert.match(held.question,/separate/);
 assert.equal(g2Material({...p,location:'Seattle  WA'}),g2Material({...p,location:'seattle WA'}));
});
test('fixture journey logs every disposition and creates a literal-cell workbook with stable row IDs',async()=>{
 const s=fresh();s.resume_version=5;s.trigger='manual';
 for(const item of s.plan){if(item.skip)continue;s.cursor=item.order;g2Reserve(s,'search',Date.parse(time));g2AddLeads(s,item,g2FixtureSearch(item),time);}
 const history=[];s.results=s.leads.map(l=>{if(l.url.includes('career-board'))l.access='unverified';else {const r=g2FixturePage(l.url);l.access=r.status===200?'readable':'restricted';if(r.status===200)l.posting=g2ParsePosting(r.text,l.url,'synthetic employer',time).posting;}
 const result={...g2Validate(l,scope,history),resume_version:5};if(result.disposition.startsWith('verified'))history.push(result);return result;});
 assert.deepEqual(s.results.map(r=>r.disposition),['excluded_unverified','verified_new','held_validation','verified_new','excluded_closed','excluded_unverified']);
 const ledger=s.results.map((record,i)=>({id:`row-${i}`,run_id:s.id,opportunity_id:`op-${i}`,version_number:1,record,created_at:time}));ledger[0].record.title='=HYPERLINK("https://evil.example")';
 const bytes=g2Workbook(s,ledger,1);assert.equal(new TextDecoder().decode(bytes).includes('<f>'),false);
 for(const r of ledger)assert.equal(g2WorkbookManifest(bytes).includes(r.id),true);
 if(process.env.G2_QA_XLSX)await writeFile(process.env.G2_QA_XLSX,bytes);
});
