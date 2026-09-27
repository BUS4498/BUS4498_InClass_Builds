// Extractive draft: only literal resume text is selected. The student confirms
// the edited summary; omitted passages are never silently marked confirmed.
export function resumeSummary(passages) {
  const groups = new Map([['Education',[]],['Experience',[]],['Projects',[]],['Leadership',[]],['Skills',[]],['Other background',[]]]);
  let section='Other background';
  for(const p of Array.isArray(passages)?passages:[]) {
    const text=String(p.text||'').trim(); if(!text)continue;
    const heading=text.replace(/[:\s]+$/,'');
    if(/^(education|academic background)$/i.test(heading)){section='Education';continue;}
    if(/^(?:(?:work|professional|relevant|employment)\s+)?experience$/i.test(heading)){section='Experience';continue;}
    if(/^(?:(?:academic|selected|personal)\s+)?projects?$/i.test(heading)){section='Projects';continue;}
    if(/^(leadership|activities|involvement|volunteer)(?:\s.*)?$/i.test(heading)&&text.length<55){section='Leadership';continue;}
    if(/^(?:technical\s+)?skills(?:\s.*)?$/i.test(heading)&&text.length<55){section='Skills';continue;}
    if(/@|https?:\/\/|linkedin\.|\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/i.test(text))continue;
    // Skip document labels, name-only header, and synthetic notices.
    if(/^(synthetic|fictional|sample resume|resume\b)/i.test(text)||(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(text)&&section==='Other background'))continue;
    const items=groups.get(section);
    const clean=text.replace(/^[•●▪\-*]\s*/, '');
    if(clean.length>320)continue; // avoid truncating a qualification into a new claim
    if(items.some(x=>x.text===clean))continue;
    items.push({text:clean,id:p.id,reference:p.reference,original:p.text,bullet:/^[•●▪\-*]/.test(text)});
  }
  const chunks=[],refs=[];
  for(const [title,items]of groups){
    if(!items.length)continue;
    // Cover each role before adding more achievements from a single role.
    let selected=items.slice(0,title==='Education'?4:title==='Skills'?3:2);
    if(['Experience','Leadership','Projects'].includes(title)){
      selected=[];let bullets=0;
      for(const item of items){if(!item.bullet){bullets=0;selected.push(item);}else if(bullets++===0)selected.push(item);}
    }
    const budget={Education:450,Experience:1000,Projects:350,Leadership:500,Skills:450,'Other background':250}[title];
    let used=0;selected=selected.filter(item=>{if(used+item.text.length>budget)return false;used+=item.text.length;return true;});
    if(selected.length){chunks.push(`${title}\n${selected.map(t=>t.text).join('\n')}`);refs.push(...selected.map(p=>({id:p.id,reference:p.reference,text:p.original})));}
  }
  return {text:chunks.join('\n\n'),sources:refs,method:'literal-excerpts-v1'};
}

export function validateResumeReview(input, passages) {
  const text=typeof input?.text==='string'?input.text.trim():'';
  if(input?.confirmed!==true||text.length<20||text.length>6000)
    return {ok:false,code:'SUMMARY_CONFIRMATION_NEEDED',question:'Review your resume summary, make any changes, and confirm the final text (20–6,000 characters).'};
  const draft=resumeSummary(passages);
  return {ok:true,review:{text,generated_text:draft.text,method:draft.method,source_ids:draft.sources.map(x=>x.id),confirmed_at:new Date().toISOString()}};
}

export async function resetStudentSetup({sql,reply},owner,payload){
  if(!Number.isInteger(payload?.expectedWorkspaceVersion)||payload.confirm!==true)
    return reply({ok:false,code:'RESET_CONFIRMATION_NEEDED'},422);
  try{
    const workspace=await sql.begin(async tx=>{
      await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
      const [current]=await tx`select setup_revision,setup_reset_at from career_prep.owners where id=${owner} for update`;
      if(!current||current.setup_revision!==payload.expectedWorkspaceVersion)throw Error('STALE_WORKSPACE');
      const active=await tx`select id from career_prep.discovery_runs where owner_id=${owner} and status='running' limit 1`;
      if(active.length)throw Error('ACTIVE_RUN');
      const [saved]=await tx`update career_prep.owners set setup_revision=setup_revision+1,setup_reset_at=now() where id=${owner} returning setup_revision,setup_reset_at`;
      return saved;
    });
    const [check]=await sql`select setup_revision,setup_reset_at from career_prep.owners where id=${owner}`;
    if(!check||check.setup_revision!==workspace.setup_revision||!check.setup_reset_at)throw Error('RESET_READBACK_FAILED');
    return reply({ok:true,workspace_version:workspace.setup_revision,message:'New setup started. Your saved resumes, opportunities, answers and downloads are retained.'});
  }catch(e){const code=String(e).includes('ACTIVE_RUN')?'ACTIVE_RUN':String(e).includes('STALE_WORKSPACE')?'STALE_WORKSPACE':'RESET_UNCONFIRMED';
    return reply({ok:false,code,message:code==='ACTIVE_RUN'?'Finish or inspect the active search before starting a new setup.':code==='STALE_WORKSPACE'?'Your setup changed in another tab. Reload before resetting.':'The reset could not be confirmed. Reload to inspect saved state.'},code==='RESET_UNCONFIRMED'?503:409);}
}
