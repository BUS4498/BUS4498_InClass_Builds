export function cleanupRequest(p){
 if(!p||!['archive','restore'].includes(p.action)||p.confirmed!==true||!Number.isInteger(p.expectedRevision)||p.expectedRevision<0||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.requestKey||''))return null;
 if(!Array.isArray(p.items)||!p.items.length||p.items.length>500)return null;
 const keys=new Set();for(const x of p.items){if(!x||!['live','synthetic'].includes(x.mode)||!/^op_[0-9a-f]{24}$/.test(x.id))return null;const key=x.mode+':'+x.id;if(keys.has(key))return null;keys.add(key);}
 return {action:p.action,items:p.items.map(x=>({mode:x.mode,id:x.id})).sort((a,b)=>(a.mode+a.id).localeCompare(b.mode+b.id)),expectedRevision:p.expectedRevision,requestKey:p.requestKey};
}
export function createOpportunityLibrary({sql,reply,jsonColumn}){
 const selectionKey=items=>JSON.stringify(items.map(x=>({mode:x.mode,id:x.id})).sort((a,b)=>(a.mode+a.id).localeCompare(b.mode+b.id)));
 async function list(owner){
  const [workspace]=await sql`select opportunity_revision from career_prep.owners where id=${owner}`;
  const rows=await sql`select distinct on (data_mode,opportunity_id) data_mode,opportunity_id,record,created_at,version_number from career_prep.opportunity_ledger where owner_id=${owner} and opportunity_id is not null order by data_mode,opportunity_id,version_number desc`;
  const visibility=await sql`select data_mode,opportunity_id,archived from career_prep.opportunity_visibility where owner_id=${owner}`;
  return reply({ok:true,revision:workspace.opportunity_revision,items:rows.map(row=>{const r=jsonColumn(row.record)||{},p=r.posting||{};return {id:row.opportunity_id,mode:row.data_mode,role:p.role||r.title||'Unverified posting',employer:p.employer||'Employer not verified',url:p.url||r.url,disposition:r.disposition||r.access||'unknown',last_seen:row.created_at,archived:visibility.some(v=>v.data_mode===row.data_mode&&v.opportunity_id===row.opportunity_id&&v.archived)};})});
 }
 async function update(owner,payload){
  const p=cleanupRequest(payload);if(!p)return reply({ok:false,message:'Choose 1–500 saved postings and confirm archive or restore.'},422);
  try{
   await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
    const [workspace]=await tx`select opportunity_revision from career_prep.owners where id=${owner} for update`;
    const [prior]=await tx`select action,selections from career_prep.opportunity_cleanup_history where owner_id=${owner} and request_id=${p.requestKey}`;
    if(prior){if(prior.action!==p.action||selectionKey(jsonColumn(prior.selections))!==selectionKey(p.items))throw Error('REQUEST_CONFLICT');return;}
    if(workspace?.opportunity_revision!==p.expectedRevision)throw Error('STALE_LIBRARY');
    const owned=await tx`select distinct data_mode,opportunity_id from career_prep.opportunity_ledger where owner_id=${owner} and opportunity_id=any(${p.items.map(x=>x.id)})`;
    if(p.items.some(x=>!owned.some(r=>r.data_mode===x.mode&&r.opportunity_id===x.id)))throw Error('SELECTION_UNAVAILABLE');
    for(const x of p.items)await tx`insert into career_prep.opportunity_visibility(owner_id,data_mode,opportunity_id,archived) values(${owner},${x.mode},${x.id},${p.action==='archive'}) on conflict(owner_id,data_mode,opportunity_id) do update set archived=excluded.archived,updated_at=now()`;
    await tx`insert into career_prep.opportunity_cleanup_history(owner_id,request_id,action,selections,revision) values(${owner},${p.requestKey},${p.action},${JSON.stringify(p.items)}::text::jsonb,${workspace.opportunity_revision+1})`;
    await tx`update career_prep.owners set opportunity_revision=opportunity_revision+1 where id=${owner}`;
   });
   const [check]=await sql`select action,selections from career_prep.opportunity_cleanup_history where owner_id=${owner} and request_id=${p.requestKey}`;
   if(!check||check.action!==p.action||selectionKey(jsonColumn(check.selections))!==selectionKey(p.items))throw Error('READBACK_FAILED');
   return reply({ok:true,message:`${p.items.length} posting${p.items.length===1?'':'s'} ${p.action==='archive'?'archived':'restored'}. Saved evidence and downloads are preserved.`});
  }catch(e){const code=String(e);return reply({ok:false,message:/STALE_LIBRARY|REQUEST_CONFLICT|SELECTION_UNAVAILABLE/.test(code)?'Your saved list changed or an item is unavailable. Refresh it and choose the postings again.':'Cleanup could not be confirmed. Refresh the saved list before trying again.'},/STALE_LIBRARY|REQUEST_CONFLICT|SELECTION_UNAVAILABLE/.test(code)?409:503);}
 }
 return {list_opportunity_library:list,update_opportunity_library:update};
}
