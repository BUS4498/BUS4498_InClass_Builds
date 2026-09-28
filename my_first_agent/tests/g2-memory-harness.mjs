import {createG4} from '../supabase/functions/_shared/g4-runtime.mjs';
import {createG4Model} from '../supabase/functions/_shared/g4-model.mjs';
// Test/preview only: no network, credentials, or persistent student storage.
import { createG2 } from '../supabase/functions/_shared/g2-runtime.ts';
import { createG3 } from '../supabase/functions/_shared/g3-runtime.mjs';
import { G3_FIXTURE_CONTEXT } from '../supabase/functions/_shared/g3-fixtures.mjs';
export const FIXTURE_SCOPE={id:'00000000-0000-4000-8000-000000000001',version_number:1,start_date:'2027-06-01',end_date:'2027-11-30',role_types:['internship','entry-level'],role_interests:['data analytics','data operations'],hard_constraints:[]};
export function g2Harness({keyPresent=false,failUpload=false,corruptDownload=false,withAssessment=false,withPreparation=false,modelFetcher}={}){
 const db={drafts:[],versions:[],reviews:[],runs:[],ledger:[],exports:[],questions:[],responses:[],files:new Map(),queries:[]};
 const clone=v=>structuredClone(v),stamp=()=>new Date().toISOString();
 async function sql(parts,...v){
  const query=parts.join('?').replace(/\s+/g,' ').trim();db.queries.push({query,values:clone(v)});
  if(query.startsWith('select pg_advisory'))return [];
  if(query.startsWith('insert into career_prep.material_drafts')){const r={id:v[0],owner_id:v[1],run_id:v[2],opportunity_id:v[3],artifact_type:v[4],data_mode:v[5],bundle:JSON.parse(v[6]),status:'generating',latest_version:0,created_at:stamp(),review_due_at:new Date(Date.now()+172800000).toISOString()};if(db.drafts.some(d=>d.owner_id===r.owner_id&&d.run_id===r.run_id))throw Error('unique draft');db.drafts.push(r);return[clone(r)];}
  if(query.startsWith('update career_prep.material_drafts')){if(query.includes('latest_version=')){const d=db.drafts.find(d=>d.owner_id===v[1]&&d.id===v[2]);if(d){d.latest_version=v[0];d.status='awaiting_review';}}else{const d=db.drafts.find(d=>d.owner_id===v[1]&&d.id===v[2]);if(d){d.status='unresolved';d.handoff=v[0];}}return[];}
  if(query.includes('from career_prep.material_drafts'))return clone(db.drafts.filter(d=>d.owner_id===v[0]&&(!query.includes('and id=')||d.id===v[1])&&(!query.includes('and run_id=')||d.run_id===v[1])).slice().reverse());
  if(query.startsWith('insert into career_prep.material_versions')){const r={id:v[0],owner_id:v[1],draft_id:v[2],version_number:v[3],request_id:v[4],content:JSON.parse(v[5]),storage_path:v[6],sha256_hex:v[7],byte_count:v[8],origin:v[9],created_at:stamp()};if(db.versions.some(x=>x.owner_id===r.owner_id&&(x.request_id===r.request_id||(x.draft_id===r.draft_id&&x.version_number===r.version_number))))throw Error('unique version');db.versions.push(r);return[];}
  if(query.includes('from career_prep.material_versions'))return clone(db.versions.filter(x=>x.owner_id===v[0]&&(!query.includes('and id=')||x.id===v[1])&&(!query.includes('and draft_id=')||(query.includes('draft_id=any')?v[1].includes(x.draft_id):x.draft_id===v[1]))&&(!query.includes('and request_id=')||x.request_id===v[1])).sort((a,b)=>b.version_number-a.version_number));
  if(query.startsWith('insert into career_prep.material_reviews')){const r={id:v[0],owner_id:v[1],draft_id:v[2],version_id:v[3],request_id:v[4],decision:v[5],intended_use:v[6],comments:v[7],attestation:JSON.parse(v[8]),created_at:stamp()};if(db.reviews.some(x=>x.owner_id===r.owner_id&&(x.request_id===r.request_id||x.version_id===r.version_id)))throw Error('unique review');db.reviews.push(r);return[];}
  if(query.includes('from career_prep.material_reviews'))return clone(db.reviews.filter(x=>x.owner_id===v[0]&&(!query.includes('and id=')||x.id===v[1])&&(!query.includes('and draft_id=')||(query.includes('draft_id=any')?v[1].includes(x.draft_id):x.draft_id===v[1]))));
  if(query.includes('candidate_handoffs h join'))return clone(db.questions.filter(q=>q.owner_id===v[0]&&q.status==='response_received'&&q.response_kind==='answer'&&db.ledger.some(l=>l.owner_id===v[0]&&l.data_mode===v[1]&&l.opportunity_id===v[2]&&l.run_id===q.run_id&&l.candidate_id===q.candidate_id)));
  if(query.startsWith('insert into career_prep.discovery_runs')){
   if(db.runs.some(r=>r.owner_id===v[1]&&(r.status==='running'||r.client_request_id===v[2])))throw Error('unique');
   const r={id:v[0],owner_id:v[1],client_request_id:v[2],data_mode:v[3],scope_id:v[4],resume_id:v[5],state:JSON.parse(v[6]),revision:0,status:'running',created_at:stamp()};db.runs.push(r);return [clone(r)];}
  if(query.startsWith('update career_prep.discovery_runs')){const r=db.runs.find(r=>r.id===v[2]&&r.owner_id===v[3]&&r.revision===v[4]);if(!r)return [];Object.assign(r,{state:JSON.parse(v[0]),status:v[1],revision:r.revision+1});return [clone(r)];}
  if(query.startsWith('select * from career_prep.discovery_runs'))return clone(db.runs.filter(r=>r.owner_id===v[0]&&(!query.includes('and id=')||r.id===v[1])&&(!query.includes('client_request_id=')||r.client_request_id===v[1])&&(!query.includes("status='running'")||r.status==='running')).slice().reverse());
  if(query.startsWith('insert into career_prep.opportunity_ledger')){const r={id:crypto.randomUUID(),owner_id:v[0],run_id:v[1],data_mode:v[2],candidate_id:v[3],opportunity_id:v[4],version_number:v[5],record:JSON.parse(v[6]),created_at:stamp()};db.ledger.push(r);return [];}
  if(query.includes('from career_prep.opportunity_ledger')){
   const rows=db.ledger.filter(r=>r.owner_id===v[0]&&(!query.includes('data_mode=')||r.data_mode===v[1])&&(!query.includes('run_id=')||r.run_id===v[1])&&(!query.includes('opportunity_id=')||r.opportunity_id===v[2]));
   if(query.includes('coalesce(max'))return [{v:Math.max(0,...rows.map(r=>r.version_number))}];
   if(query.includes('distinct on')){const found=new Map();for(const r of rows.filter(r=>['verified_new','verified_changed','excluded_unchanged'].includes(r.record.disposition)))found.set(r.opportunity_id,r);return clone([...found.values()]);}
   const historyDisposition=r=>{const record=typeof r.record==='string'&&query.includes('jsonb_typeof(record)')?JSON.parse(r.record):r.record;return record?.disposition;};
   return clone(query.includes('order by version_number desc')?rows.filter(r=>!query.includes('jsonb_typeof')||['verified_new','verified_changed','excluded_unchanged'].includes(historyDisposition(r))).sort((a,b)=>b.version_number-a.version_number):rows);}
  if(query.startsWith('insert into career_prep.discovery_exports')){const r={id:crypto.randomUUID(),owner_id:v[0],run_id:v[1],version_number:v[2],storage_path:v[3],sha256_hex:v[4],row_ids:JSON.parse(v[5]),byte_count:v[6]};db.exports.push(r);return [clone(r)];}
  if(query.includes('from career_prep.discovery_exports')){const rows=db.exports.filter(r=>r.owner_id===v[0]&&(!query.includes('and id=')||r.id===v[1]));return query.includes('coalesce(max')?[{v:Math.max(0,...rows.map(r=>r.version_number))}]:clone(rows);}
  if(query.startsWith('insert into career_prep.candidate_handoffs')){const r={id:crypto.randomUUID(),owner_id:v[0],run_id:v[1],candidate_id:v[2],question:v[3],source_reference:v[4],status:'awaiting_student',response_due_at:stamp(),case_data:v[5]?JSON.parse(v[5]):null,version_number:1};if(db.questions.some(q=>q.owner_id===r.owner_id&&q.run_id===r.run_id&&q.candidate_id===r.candidate_id&&q.case_data?.case_key===r.case_data?.case_key))throw Error('unique case');db.questions.push(r);return [clone(r)];}
  if(query.startsWith('update career_prep.candidate_handoffs')){const r=db.questions.find(r=>r.owner_id===v[3]&&r.id===v[4]&&['awaiting_student','still_unresolved'].includes(r.status)&&(!query.includes('and version_number=')||r.version_number===v[5]));if(!r)return [];Object.assign(r,{answer:v[0],response_kind:v[1],status:v[2],version_number:r.version_number+1});return [clone(r)];}
  if(query.includes('from career_prep.candidate_handoffs'))return clone(db.questions.filter(r=>r.owner_id===v[0]&&(!query.includes('and id=')||r.id===v[1])&&(!query.includes('and run_id=')||r.run_id===v[1])&&(!query.includes('and candidate_id=')||r.candidate_id===v[2])));
  if(query.startsWith('insert into career_prep.candidate_response_history')){if(db.responses.some(r=>r.owner_id===v[0]&&r.request_id===v[2]))throw Error('duplicate response');db.responses.push({id:crypto.randomUUID(),owner_id:v[0],question_id:v[1],request_id:v[2],question_version:v[3],response_kind:v[4],response_text:v[5]});return [];}
  if(query.includes('from career_prep.candidate_response_history'))return clone(db.responses.filter(r=>r.owner_id===v[0]&&r.question_id===v[1]&&r.request_id===v[2]));
  throw Error('Unhandled fixture query: '+query);
 }
 sql.begin=async fn=>{const before=clone({ledger:db.ledger,questions:db.questions,responses:db.responses,drafts:db.drafts,versions:db.versions,reviews:db.reviews});try{return await fn(sql);}catch(e){Object.assign(db,before);throw e;}};
 const storage={from:()=>({upload:async(path,bytes)=>{if(failUpload)return {error:'fixture upload failure'};if(db.files.has(path))return {error:'exists'};db.files.set(path,bytes.slice());return {error:null};},download:async path=>{const bytes=db.files.get(path);return bytes?{data:new Blob([corruptDownload?new Uint8Array([0]):bytes]),error:null}:{error:'missing'};}})};
 globalThis.Deno={env:{get:()=>keyPresent?'synthetic-key-never-send':undefined}};
 const assessment=withAssessment?createG3({apiKey:keyPresent?'synthetic-key-never-send':null,recommendationModel:'test-configuration',...(modelFetcher?{fetcher:modelFetcher}:{})}):null;
 const preparation=withPreparation?createG4({sql,storage,model:createG4Model({}),reply:(v,s=200)=>Response.json(v,{status:s}),jsonColumn:v=>typeof v==='string'?JSON.parse(v):v}):null;
 const api=createG2({sql,storage,assessment,preparation,reply:(value,status=200)=>Response.json(value,{status}),jsonColumn:v=>typeof v==='string'?JSON.parse(v):v,retrieveContext:async()=>Response.json({ok:true,...(withAssessment?G3_FIXTURE_CONTEXT:{scope:FIXTURE_SCOPE,resume:{id:'00000000-0000-4000-8000-000000000002',version_number:5}})})});
 return {db,api,preparation};
}
export async function finishFixture(api,owner='student-a',mode='synthetic'){
 let response=await api.start_discovery(owner,{requestKey:crypto.randomUUID(),mode}),data=await response.json();if(!data.ok)throw Error(data.code);
 for(let n=0;data.run.status==='running'&&n<260;n++){response=await api.step_discovery(owner,{runId:data.run.id,expectedRevision:data.run.revision});data=await response.json();if(!data.ok)throw Error(data.code);}
 return data.run;
}
