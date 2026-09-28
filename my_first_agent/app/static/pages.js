(() => {
  const names={setup:'My setup',opportunities:'Opportunities',preparation:'Preparation',schedule:'Schedule'};
  function show(){
    const path=location.pathname.replace(/^\/+|\/+$/g,'');
    let page=names[path]?path:location.hash==='#opportunities'||location.hash.startsWith('#question-')?'opportunities':'setup';
    for(const node of document.querySelectorAll('[data-page]'))node.hidden=node.dataset.page!==page;
    for(const link of document.querySelectorAll('[data-page-link]')){const active=link.dataset.pageLink===page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    document.title=`${names[page]} · Career Opportunity Prep`;
    document.body.dataset.currentPage=page;
    if(location.hash.startsWith('#question-'))requestAnimationFrame(()=>document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
  }
  function navigate(page){if(!names[page])return;history.pushState({},'',`/${page}`);show();window.scrollTo({top:0,behavior:'instant'});document.querySelector(`[data-page="${page}"] h1`)?.focus({preventScroll:true});}
  document.addEventListener('click',event=>{const a=event.target.closest('a[data-page-link]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.dataset.pageLink);});
  window.addEventListener('popstate',show);window.addEventListener('hashchange',show);
  window.CareerPages={navigate};show();
})();
