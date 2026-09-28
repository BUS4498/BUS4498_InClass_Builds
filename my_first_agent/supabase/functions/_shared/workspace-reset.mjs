// All identities come from the authenticated gateway, never from the request body.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RESET_TABLES=['material_reviews','material_versions','material_drafts','candidate_response_history','candidate_handoffs','opportunity_visibility','opportunity_cleanup_history','opportunity_ledger','discovery_exports','discovery_runs','context_handoffs','student_scopes','resume_versions'];
const RESET_OPS=new Set(['preview_full_reset','reset_all_student_data']);
const BUCKET='career-prep-private';
export function createWorkspaceReset({sql,storage,reply}){
 async function workspace(owner,tx=sql){const [r]=await tx`select setup_revision,reset_pending,reset_request_id,last_reset_request_id from career_prep.owners where id=${owner}`;return r;}
 async function fileCount(owner){const [r]=await sql`select count(*)::int as count from storage.objects where bucket_id=${BUCKET} and starts_with(name,${owner+'/'})`;return r.count;}
 async function counts(owner){const out={};for(const table of RESET_TABLES){const [r]=await sql`select count(*)::int as count from ${sql('career_prep.'+table)} where owner_id=${owner}`;out[table]=r.count;}out.files=await fileCount(owner);return out;}
 async function preview(owner){const w=await workspace(owner);return reply({ok:true,workspace_version:w.setup_revision,reset_pending:w.reset_pending,request_key:w.reset_pending?w.reset_request_id:null,counts:await counts(owner)});}
 async function reset(owner,p){
  if(p?.confirmation!=='RESET'||!UUID.test(p?.requestKey||'')||!Number.isInteger(p?.expectedWorkspaceVersion))return reply({ok:false,code:'RESET_CONFIRMATION_REQUIRED',message:'Review the data summary and type RESET to confirm permanent deletion.'},422);
  try{
   const first=await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
    const w=await workspace(owner,tx);
    if(w.last_reset_request_id===p.requestKey)return 'complete';
    if(w.reset_pending){if(w.reset_request_id!==p.requestKey)throw Error('RESET_REQUEST_CHANGED');return 'continue';}
    if(w.setup_revision!==p.expectedWorkspaceVersion)throw Error('SETUP_CHANGED');
    await tx`update career_prep.owners set reset_pending=true,reset_request_id=${p.requestKey} where id=${owner}`;
    return 'start';
   });
   if(first==='complete')return reply({ok:true,complete:true,message:'Your saved data has been reset.'});
   const files=await sql`select name from storage.objects where bucket_id=${BUCKET} and starts_with(name,${owner+'/'}) order by name limit 500`;
   if(files.some(x=>!x.name.startsWith(owner+'/')))throw Error('PATH_SCOPE');
   if(files.length){const r=await storage.from(BUCKET).remove(files.map(x=>x.name));if(r.error)throw Error('STORAGE_DELETE');
    const left=await sql`select name from storage.objects where bucket_id=${BUCKET} and name=any(${files.map(x=>x.name)})`;if(left.length)throw Error('STORAGE_READBACK');}
   const remaining=await fileCount(owner);
   if(remaining)return reply({ok:true,complete:false,remaining_files:remaining,message:`Reset in progress. ${remaining} stored files remain. Continue the reset to finish.`});
   await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
    const w=await workspace(owner,tx);if(!w.reset_pending||w.reset_request_id!==p.requestKey)throw Error('RESET_REQUEST_CHANGED');
    for(const table of RESET_TABLES)await tx`delete from ${tx('career_prep.'+table)} where owner_id=${owner}`;
    await tx`update career_prep.owners set setup_revision=setup_revision+1,opportunity_revision=opportunity_revision+1,setup_reset_at=now(),reset_pending=false,reset_request_id=null,last_reset_request_id=${p.requestKey} where id=${owner}`;
   });
   const after=await counts(owner);if(Object.values(after).some(n=>n!==0))throw Error('RESET_READBACK');
   return reply({ok:true,complete:true,message:'Your saved setup, resumes, runs, opportunities, answers, and generated files have been deleted. You can start again.'});
  }catch(e){const changed=/SETUP_CHANGED|RESET_REQUEST_CHANGED/.test(String(e));return reply({ok:false,code:changed?'RESET_PREVIEW_CHANGED':'RESET_INCOMPLETE',message:changed?'Your workspace or reset request changed. Reopen the data summary before confirming.':'The reset is incomplete. Other actions are paused to protect your data. Reopen Reset all my data to inspect and continue; nothing will retry automatically.'},changed?409:503);}
 }
 // A persisted lease covers each whole request, including network calls. Fifteen minutes
 // exceeds Supabase's maximum 400-second worker lifetime, so an expired lease cannot
 // be a still-running hosted writer. Do not shorten this if the hosting limit changes.
 async function guard(owner,requestId,operation,action){
  const resetOp=RESET_OPS.has(operation);
  try{
   await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
    await tx`delete from career_prep.workspace_requests where owner_id=${owner} and expires_at<now()`;
    const w=await workspace(owner,tx);
    if(w.reset_pending&&!resetOp)throw Error('RESET_IN_PROGRESS');
    const active=await tx`select operation from career_prep.workspace_requests where owner_id=${owner}`;
    if(active.some(x=>x.operation==='reset_all_student_data')||(operation==='reset_all_student_data'&&active.length))throw Error('WORKSPACE_BUSY');
    await tx`insert into career_prep.workspace_requests(owner_id,request_id,operation,expires_at) values(${owner},${requestId},${operation},now()+interval '15 minutes')`;
   });
  }catch(e){const resetting=String(e).includes('RESET_IN_PROGRESS');return reply({ok:false,code:resetting?'RESET_IN_PROGRESS':'WORKSPACE_BUSY',message:resetting?'A full reset is unfinished. Open Reset all my data to continue.':'Another workspace action is still in progress. Wait for it to finish, then reopen the reset. An interrupted request may take up to 15 minutes to clear.'},409);}
  try{return await action();}finally{await sql`delete from career_prep.workspace_requests where owner_id=${owner} and request_id=${requestId}`;}
 }
 return {guard,preview_full_reset:preview,reset_all_student_data:reset};
}
