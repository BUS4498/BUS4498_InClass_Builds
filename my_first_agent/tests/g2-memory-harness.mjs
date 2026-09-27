// Test/preview only: no network, credentials, or persistent student storage.
import { createG2 } from '../supabase/functions/_shared/g2-runtime.ts';
export const FIXTURE_SCOPE={id:'00000000-0000-4000-8000-000000000001',version_number:1,start_date:'2027-06-01',end_date:'2027-11-30',role_types:['internship','entry-level'],role_interests:['data analytics','data operations'],hard_constraints:[]};
export function g2Harness({keyPresent=false,failUpload=false,corruptDownload=false}={}){
 const db={runs:[],ledger:[],exports:[],questions:[],files:new Map(),queries:[]};
 const clone=v=>structuredClone(v),stamp=()=>new Date().toISOString();
 async function sql(parts,...v){
  const query=parts.join('?').replace(/\s+/g,' ').trim();db.queries.push({query,values:clone(v)});
  if(query.startsWith('select pg_advisory'))return [];
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
   return clone(rows);}
  if(query.startsWith('insert into career_prep.discovery_exports')){const r={id:crypto.randomUUID(),owner_id:v[0],run_id:v[1],version_number:v[2],storage_path:v[3],sha256_hex:v[4],row_ids:JSON.parse(v[5]),byte_count:v[6]};db.exports.push(r);return [clone(r)];}
  if(query.includes('from career_prep.discovery_exports')){const rows=db.exports.filter(r=>r.owner_id===v[0]&&(!query.includes('and id=')||r.id===v[1]));return query.includes('coalesce(max')?[{v:Math.max(0,...rows.map(r=>r.version_number))}]:clone(rows);}
  if(query.startsWith('insert into career_prep.candidate_handoffs')){db.questions.push({id:crypto.randomUUID(),owner_id:v[0],run_id:v[1],candidate_id:v[2],question:v[3],source_reference:v[4],status:'awaiting_student',response_due_at:stamp()});return [];}
  if(query.startsWith('update career_prep.candidate_handoffs')){const r=db.questions.find(r=>r.owner_id===v[3]&&r.id===v[4]&&['awaiting_student','still_unresolved'].includes(r.status));if(!r)return [];Object.assign(r,{answer:v[0],response_kind:v[1],status:v[2]});return [clone(r)];}
  if(query.includes('from career_prep.candidate_handoffs'))return clone(db.questions.filter(r=>r.owner_id===v[0]));
  throw Error('Unhandled fixture query: '+query);
 }
 sql.begin=async fn=>{const before=clone({ledger:db.ledger,questions:db.questions});try{return await fn(sql);}catch(e){Object.assign(db,before);throw e;}};
 const storage={from:()=>({upload:async(path,bytes)=>{if(failUpload)return {error:'fixture upload failure'};if(db.files.has(path))return {error:'exists'};db.files.set(path,bytes.slice());return {error:null};},download:async path=>{const bytes=db.files.get(path);return bytes?{data:new Blob([corruptDownload?new Uint8Array([0]):bytes]),error:null}:{error:'missing'};}})};
 globalThis.Deno={env:{get:()=>keyPresent?'synthetic-key-never-send':undefined}};
 const api=createG2({sql,storage,reply:(value,status=200)=>Response.json(value,{status}),jsonColumn:v=>typeof v==='string'?JSON.parse(v):v,retrieveContext:async()=>Response.json({ok:true,scope:FIXTURE_SCOPE,resume:{id:'00000000-0000-4000-8000-000000000002',version_number:5}})});
 return {db,api};
}
export async function finishFixture(api,owner='student-a',mode='synthetic'){
 let response=await api.start_discovery(owner,{requestKey:crypto.randomUUID(),mode}),data=await response.json();if(!data.ok)throw Error(data.code);
 for(let n=0;data.run.status==='running'&&n<50;n++){response=await api.step_discovery(owner,{runId:data.run.id,expectedRevision:data.run.revision});data=await response.json();if(!data.ok)throw Error(data.code);}
 return data.run;
}
