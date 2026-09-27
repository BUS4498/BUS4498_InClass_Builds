(() => {
 const $=s=>document.querySelector(s),dialog=$('#reset-all-dialog');let preview=null,requestKey=null,busy=false;
 const message=t=>$('#reset-all-feedback').textContent=t;
 async function call(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!d.ok)throw Error(d.message||'The saved result could not be confirmed.');return d;}
 function ready(){ $('#reset-all-confirm').disabled=busy||!preview||$('#reset-all-phrase').value!=='RESET'; }
 async function open(){preview=null;requestKey=null;$('#reset-all-phrase').value='';$('#reset-all-counts').textContent='Reading your saved data…';message('');ready();dialog.showModal();
  try{preview=await call('/api/workspace/reset-preview',{});requestKey=preview.request_key||crypto.randomUUID();const c=preview.counts;
   const count=(n,label)=>`${n} ${label}${n===1?'':'s'}`;
   $('#reset-all-counts').textContent=[count(c.resume_versions,'saved resume version'),count(c.discovery_runs,'run'),count(c.opportunity_ledger,'opportunity record'),count(c.material_drafts,'preparation draft'),count(c.files,'stored file')].join(' · ')+'. Saved preferences, answers, archives, and reviews are also deleted.';
   $('#reset-all-confirm').textContent=preview.reset_pending?'Continue permanent reset':'Delete all my saved data';
   if(preview.reset_pending)message('A previous reset is unfinished. Confirm to continue deleting the remaining data.');
  }catch(e){message(e.message);}ready();
 }
 for(const b of document.querySelectorAll('[data-reset-all]'))b.addEventListener('click',open);
 $('#reset-all-phrase').addEventListener('input',ready);
 $('#reset-all-cancel').addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('#reset-all-confirm').addEventListener('click',async()=>{if(!preview||busy||$('#reset-all-phrase').value!=='RESET')return;busy=true;ready();$('#reset-all-cancel').disabled=true;message('Deleting your saved data. Keep this tab open.');
  try{const d=await call('/api/workspace/reset-all',{requestKey,expectedWorkspaceVersion:preview.workspace_version,confirmation:'RESET'});
   if(!d.complete){message(d.message);$('#reset-all-confirm').textContent='Continue permanent reset';return;}
   // Full reload removes all in-memory forms, cards, run lists, and download URLs.
   window.dispatchEvent(new Event('career:full-reset-complete'));window.location.assign('/setup?reset=complete');
  }catch(e){message(e.message);}finally{busy=false;$('#reset-all-cancel').disabled=false;ready();}
 });
 if(new URLSearchParams(location.search).get('reset')==='complete'){
  window.dispatchEvent(new Event('career:full-reset-complete'));
  $('#reset-all-result').hidden=false;$('#reset-all-result').textContent='Reset complete. Your saved data has been deleted. Upload a resume to start again.';
  history.replaceState(null,'','/setup');
 }
})();
