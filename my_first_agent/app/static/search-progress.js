(() => {
  const searchStages=[['search','Search sources'],['read','Read postings'],['validate','Check sources'],['assess','Assess fit'],['ledger','Save opportunities'],['export','Save workbook']];
  function describe(run){
    const stages=run.trigger==='targeted_update'?[...searchStages.slice(1,4),['prepare','Prepare material'],...searchStages.slice(4)]:searchStages;
    const c=run.counters||{},a=run.assessment_progress||{},items=run.candidates||[];
    const running=run.status==='running',success=['complete','awaiting_student'].includes(run.status);
    const index=stages.findIndex(([id])=>id===run.stage);
    const failedStage=run.failure_stage||(run.assessment_counters&&items.some(c=>c.assessment?.failure_category==='operational'||c.assessment_status==='not_processed'||c.recommendation_status==='failed')?'assess':null);
    const failedIndex=stages.findIndex(([id])=>id===failedStage);
    const complete=stages.map(([id],i)=>{
      if(id==='ledger')return run.ledger_status==='verified';
      if(id==='export')return run.export_status==='verified';
      if(failedIndex>=0)return i<failedIndex;
      return success||(index>=0&&i<index);
    });
    const assessed=a.completed??items.filter(c=>c.assessment?.status==='completed').length;
    const skipped=stages.map(([id])=>success&&((id==='assess'&&!assessed)||(id==='prepare'&&!run.preparation_calls)));
    const count=complete.filter((done,i)=>done&&!skipped[i]).length,handled=count+skipped.filter(Boolean).length;
    const current=stages[index]?.[1]||(run.stage==='prepare'?'Prepare requested material':'Finish run');
    const details={search:`${c.api_attempts||0} search attempts · ${c.leads||0} leads found`,
      read:`${c.reads||0} posting reads · ${c.skipped||0} pages skipped`,
      validate:`Checking identity, dates, duplicates, and available evidence for ${c.leads||0} leads`,
      assess:`${a.completed??items.filter(c=>c.assessment?.status==='completed').length} of ${a.total??items.filter(c=>c.disposition?.startsWith('verified_')).length} postings assessed · ${run.assessment_counters?.model_calls||0} assessment requests${a.role?` · ${a.role}`:''}${a.last_subtask?` · Last completed: ${a.last_subtask}`:''}`,
      ledger:'Writing and verifying the opportunity history',export:'Creating and verifying the downloadable workbook',prepare:'Creating the requested preparation material'};
    return {percent:Math.round(handled/stages.length*100),count,skipped,
      title:running?current:success?(assessed?'Run complete':'Run finished · no assessments'):'Run needs attention',
      detail:running?details[run.stage]||'Finishing saved work':success?(assessed?`${assessed} posting${assessed===1?'':'s'} assessed. Results and storage status are shown below.`:'No new assessment was completed. Review the saved posting reasons and source coverage below.'):'Some work did not finish. Saved evidence is retained; review the issue below.',
      running,complete,stages,success};
  }
  function render(run,busy=false){
    const data=describe(run),root=document.querySelector('#search-progress');if(!root)return;
    root.hidden=false;document.querySelector('#progress-mode').textContent=run.mode==='synthetic'?'Synthetic test progress':run.trigger==='targeted_update'?'Saved posting update':'Live search progress';root.dataset.state=data.running?'running':data.success?'complete':'attention';
    document.querySelector('#progress-title').textContent=data.title;
    const skippedCount=data.skipped.filter(Boolean).length;
    const countText=skippedCount?`${data.count} stages complete · ${skippedCount} skipped`:`${data.count} of ${data.stages.length} stages complete`;
    document.querySelector('#progress-count').textContent=countText;
    const bar=document.querySelector('#progress-bar');bar.value=data.percent;
    bar.setAttribute('aria-valuetext',`${countText}. ${data.title}.`);
    document.querySelector('#progress-detail').textContent=data.detail;
    document.querySelector('#progress-wait').textContent=data.running?(busy?'Current request in progress. This view updates after each response.':'Progress saved. Continue this run to finish the remaining work.'):'';
    const list=document.querySelector('#progress-stages');list.replaceChildren();
    data.stages.forEach(([id,name],i)=>{const li=document.createElement('li');li.textContent=data.skipped[i]?`${name} · skipped`:`${data.complete[i]?'✓ ':''}${name}`;li.className=data.skipped[i]?'skipped':data.complete[i]?'done':run.stage===id&&data.running?'current':'';if(run.stage===id&&data.running)li.setAttribute('aria-current','step');list.append(li);});
  }
  window.CareerSearchProgress={describe,render};
})();
