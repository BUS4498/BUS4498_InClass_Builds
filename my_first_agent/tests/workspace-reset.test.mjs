import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspaceReset,RESET_TABLES} from '../supabase/functions/_shared/workspace-reset.mjs';
import worker from '../app/worker/index.mjs';
export function resetHarness(){
 const owners=new Map(['a','b'].map(id=>[id,{setup_revision:3,opportunity_revision:0,reset_pending:false,reset_request_id:null,last_reset_request_id:null}]));
 const records=Object.fromEntries(RESET_TABLES.map(t=>[t,[{owner_id:'a'},{owner_id:'b'}]])),files=new Set(['a/resumes/original.pdf','a/orphan.bin','b/resumes/original.pdf']),leases=[];let failStorage=false;
 function sql(parts,...v){if(typeof parts==='string')return {identifier:parts};return query(parts,...v);}
 async function query(parts,...v){let q=parts.join('?').replace(/\s+/g,' ').trim();
  if(q.startsWith('select pg_advisory'))return [];
  if(q.startsWith('select setup_revision'))return[structuredClone(owners.get(v[0]))];
  if(q.startsWith('select count(*)')&&v[0]?.identifier)return[{count:records[v[0].identifier.split('.').at(-1)].filter(r=>r.owner_id===v[1]).length}];
  if(q.startsWith('delete from ?')){const t=v[0].identifier.split('.').at(-1);records[t]=records[t].filter(r=>r.owner_id!==v[1]);return[];}
  if(q.includes('from storage.objects')){const subset=[...files].filter(n=>q.includes('name=any')?v[1].includes(n):n.startsWith(v[1]));return q.startsWith('select count')?[{count:subset.length}]:subset.slice(0,500).map(name=>({name}));}
  if(q.startsWith('update career_prep.owners')){const w=owners.get(v[1]);if(q.includes('reset_pending=true'))Object.assign(w,{reset_pending:true,reset_request_id:v[0]});else Object.assign(w,{reset_pending:false,reset_request_id:null,last_reset_request_id:v[0],setup_revision:w.setup_revision+1,opportunity_revision:w.opportunity_revision+1});return[];}
  if(q.startsWith('select operation'))return leases.filter(x=>x.owner_id===v[0]);
  if(q.startsWith('insert into career_prep.workspace_requests')){leases.push({owner_id:v[0],request_id:v[1],operation:v[2],expires_at:Date.now()+900000});return[];}
  if(q.startsWith('delete from career_prep.workspace_requests')){for(let i=leases.length-1;i>=0;i--)if(leases[i].owner_id===v[0]&&(q.includes('expires_at')?leases[i].expires_at<Date.now():leases[i].request_id===v[1]))leases.splice(i,1);return[];}
  throw Error('Unknown query '+q);
 }
 sql.begin=async fn=>{const before=structuredClone({owners:[...owners],records,leases});try{return await fn(sql);}catch(e){owners.clear();before.owners.forEach(([k,v])=>owners.set(k,v));Object.assign(records,before.records);leases.splice(0,leases.length,...before.leases);throw e;}};
 const storage={from:bucket=>{assert.equal(bucket,'career-prep-private');return {remove:async paths=>{if(failStorage)return{error:'fixture storage failure'};paths.forEach(p=>files.delete(p));return{error:null};}}}};
 const api=createWorkspaceReset({sql,storage,reply:(v,s=200)=>Response.json(v,{status:s})});
 const call=async(op,p={})=>api.guard('a',crypto.randomUUID(),op,()=>api[op]('a',p));
 return {api,call,owners,records,files,leases,setFailStorage:v=>failStorage=v};
}
const payload=()=>({confirmation:'RESET',requestKey:crypto.randomUUID(),expectedWorkspaceVersion:3});
test('full reset removes all owner records and stored files including orphans, while preserving another owner',async()=>{
 const h=resetHarness(),p=payload(),preview=await(await h.call('preview_full_reset')).json();assert.equal(preview.counts.files,2);
 assert.equal((await(await h.call('reset_all_student_data',p)).json()).complete,true);
 for(const t of RESET_TABLES)assert.deepEqual(h.records[t],[{owner_id:'b'}]);assert.deepEqual([...h.files],['b/resumes/original.pdf']);assert.equal(h.owners.get('a').reset_pending,false);assert.equal(h.leases.length,0);
 h.records.resume_versions.push({owner_id:'a'});h.files.add('a/new.pdf');assert.equal((await(await h.call('reset_all_student_data',p)).json()).complete,true);assert.equal(h.files.has('a/new.pdf'),true);assert.equal(h.records.resume_versions.length,2);
});
test('confirmation, stale setup, and active writer checks prevent deletion',async()=>{
 const h=resetHarness();assert.equal((await h.call('reset_all_student_data',{...payload(),confirmation:'yes'})).status,422);
 assert.equal((await h.call('reset_all_student_data',{...payload(),expectedWorkspaceVersion:2})).status,409);
 h.leases.push({owner_id:'a',request_id:'another',operation:'preview_resume',expires_at:Date.now()+10000});assert.equal((await h.call('reset_all_student_data',payload())).status,409);assert.equal(h.files.size,3);assert.equal(h.owners.get('a').reset_pending,false);
});
test('file deletion failure keeps rows, pauses other actions, and supports explicit continuation of the same reset',async()=>{
 const h=resetHarness(),p=payload();h.setFailStorage(true);assert.equal((await h.call('reset_all_student_data',p)).status,503);assert.equal(h.records.resume_versions.length,2);assert.equal(h.owners.get('a').reset_pending,true);
 let entered=false;const blocked=await h.api.guard('a',crypto.randomUUID(),'start_discovery',async()=>{entered=true;});assert.equal(blocked.status,409);assert.equal(entered,false);
 assert.equal((await(await h.call('preview_full_reset')).json()).request_key,p.requestKey);h.setFailStorage(false);assert.equal((await(await h.call('reset_all_student_data',p)).json()).complete,true);
});
test('large resets retain the deletion gate between chunks and never delete another owner prefix',async()=>{
 const h=resetHarness(),p=payload();for(let i=0;i<510;i++)h.files.add('a/exports/'+i);h.files.add('ab/keep.pdf');let r=await(await h.call('reset_all_student_data',p)).json();assert.equal(r.complete,false);assert.equal(r.remaining_files,12);assert.equal(h.records.resume_versions.length,2);r=await(await h.call('reset_all_student_data',p)).json();assert.equal(r.complete,true);assert.equal(h.files.has('ab/keep.pdf'),true);
});
test('a reset lease prevents a second reset or another API action entering concurrently',async()=>{
 const h=resetHarness();h.leases.push({owner_id:'a',request_id:'ongoing',operation:'reset_all_student_data',expires_at:Date.now()+10000});let called=false;
 const r=await h.api.guard('a',crypto.randomUUID(),'preview_resume',async()=>{called=true;});assert.equal(r.status,409);assert.equal(called,false);assert.equal((await h.call('reset_all_student_data',payload())).status,409);
});
test('reset endpoints reject signed-out and cross-origin requests before forwarding',async()=>{
 for(const path of ['/api/workspace/reset-preview','/api/workspace/reset-all']){
  const url='https://site.example'+path;assert.equal((await worker.fetch(new Request(url,{method:'POST'}),{})).status,401);
  const r=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'https://other.example','content-type':'application/json','oai-authenticated-user-email':'student@example.com'},body:'{}'}),{G1_GATEWAY_SECRET:'fixture',SUPABASE_G1_URL:'https://no-network.invalid'});assert.equal(r.status,403);
 }
});
