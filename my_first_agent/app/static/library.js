(() => {
 const $=s=>document.querySelector(s),make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 let items=[],revision=0,selected=new Set(),loaded=false,pending=null;
 const key=x=>x.mode+':'+x.id;
 const subset=()=>items.filter(x=>($('#library-filter').value==='archived'?x.archived:!x.archived)&&($('#library-mode').value==='all'||x.mode===$('#library-mode').value));
 async function call(route,body){const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return r.json();}
 function render(){const rows=$('#library-items');rows.replaceChildren();const visible=subset();$('#library-count').textContent=`${visible.length} ${$('#library-filter').value} postings · ${selected.size} selected`;
  $('#library-all').checked=visible.length>0&&visible.every(x=>selected.has(key(x)));$('#library-action').textContent=$('#library-filter').value==='archived'?'Restore selected':'Archive selected';$('#library-action').disabled=!loaded||!selected.size;
  if(!visible.length)rows.append(make('p',loaded?'No postings in this view.':'Loading your saved opportunities…'));
  for(const item of visible){const row=make('label');row.className='library-row';const box=make('input');box.type='checkbox';box.checked=selected.has(key(item));box.setAttribute('aria-label',`Select ${item.employer} — ${item.role}`);box.addEventListener('change',()=>{box.checked?selected.add(key(item)):selected.delete(key(item));render();});const body=make('span');body.append(make('strong',item.role),make('span',item.employer),make('small',`${item.mode==='synthetic'?'Synthetic sample':'Live posting'} · ${item.disposition.replaceAll('_',' ')} · last seen ${new Date(item.last_seen).toLocaleDateString()}`));row.append(box,body);rows.append(row);}
  window.dispatchEvent(new CustomEvent('career:library-changed'));
 }
 async function refresh(){try{const d=await call('/api/g2/library',{});if(!d.ok)throw Error(d.message||'Saved opportunities could not be read.');items=d.items;revision=d.revision;loaded=true;selected.clear();$('#library-message').textContent='';render();}catch(e){loaded=false;$('#library-message').textContent=e.message;render();}}
 for(const id of ['library-filter','library-mode'])$('#'+id).addEventListener('change',()=>{selected.clear();render();});
 $('#library-all').addEventListener('change',()=>{selected=$('#library-all').checked?new Set(subset().map(key)):new Set();render();});
 $('#library-refresh').addEventListener('click',refresh);
 $('#library-action').addEventListener('click',()=>{const picked=subset().filter(x=>selected.has(key(x)));if(!picked.length)return;pending={action:$('#library-filter').value==='archived'?'restore':'archive',items:picked.map(({id,mode})=>({id,mode})),expectedRevision:revision,requestKey:crypto.randomUUID(),confirmed:true};$('#cleanup-title').textContent=`${pending.action==='archive'?'Archive':'Restore'} ${picked.length} posting${picked.length===1?'':'s'}?`;$('#cleanup-summary').textContent=picked.slice(0,5).map(x=>`${x.employer} — ${x.role}`).join('; ')+(picked.length>5?`; and ${picked.length-5} more.`:'');$('#cleanup-feedback').textContent='';$('#cleanup-dialog').showModal();});
 $('#cleanup-cancel').addEventListener('click',()=>$('#cleanup-dialog').close());
 $('#cleanup-confirm').addEventListener('click',async()=>{if(!pending)return;$('#cleanup-confirm').disabled=true;try{const d=await call('/api/g2/library/update',pending);if(!d.ok){$('#cleanup-feedback').textContent=d.message;return;}pending=null;$('#cleanup-dialog').close();await refresh();$('#library-message').textContent=d.message;}catch{$('#cleanup-feedback').textContent='Cleanup could not be confirmed. Close this dialog and refresh the saved list.';}finally{$('#cleanup-confirm').disabled=false;}});
 window.CareerLibrary={refresh,visible:(mode,id)=>!items.some(x=>x.mode===mode&&x.id===id&&x.archived),get loaded(){return loaded;}};
 refresh();
})();
