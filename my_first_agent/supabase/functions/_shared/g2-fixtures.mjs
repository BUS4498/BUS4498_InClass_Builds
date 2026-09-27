// Server-owned fictional evidence. Never fetched from the network.
export const G2_FIXTURE_NOTICE = 'SYNTHETIC TEST RUN: fictional employers and URLs; no live discovery or model call.';
export function g2FixtureSearch(item) {
  if(item.name==='Indeed') return { sources:[{url:'https://career-board.example/listings/8421',title:'Synthetic secondary listing'}],queries:[item.intent],observed:0 };
  if(item.name!=='Employer career sites') return {sources:[],queries:[item.intent],observed:0};
  return {sources:[
    {url:'https://careers.northstar-civic.example/jobs/NCD-271',title:'Data Operations Intern'},
    {url:'https://careers.northstar-civic.example/jobs/NCD-AMBIGUOUS',title:'Data Operations Intern — ambiguous identity'},
    {url:'https://jobs.harbor-insights.example/roles/HHI-117',title:'Junior Data Analyst'},
    {url:'https://careers.northstar-civic.example/jobs/NCD-CLOSED',title:'Closed Data Operations Intern'},
    {url:'https://careers.northstar-civic.example/jobs/NCD-RESTRICTED',title:'Restricted posting fixture'},
  ],queries:[item.intent],observed:0};
}
export function g2FixturePage(url) {
  if(url.includes('RESTRICTED')) return {status:403,text:''};
  if(url.includes('career-board.example')) return {status:200,text:'Secondary listing without employer corroboration.'};
  const harbor=url.includes('harbor'), closed=url.includes('CLOSED');
  const job={'@context':'https://schema.org','@type':'JobPosting',url,
    title:harbor?'Junior Data Analyst':'Data Operations Intern',hiringOrganization:{name:harbor?'Harbor Insights':'Northstar Civic Data'},
    identifier:{value:url.includes('AMBIGUOUS')?'':harbor?'HHI-117':closed?'NCD-CLOSED':'NCD-271'},
    description:'Synthetic fixture. This data analytics and data operations role starts in summer 2027. Use Excel and SQL to prepare reports.',
    jobStartDate:harbor?'2027-09-01':'2027-06-15',datePosted:'2026-09-15',validThrough:closed?'2026-01-01':'2027-03-01',
    qualifications:'Experience with Excel and SQL through work or coursework.',
    jobLocation:{address:{addressLocality:'Seattle',addressRegion:'WA',addressCountry:'US'}}};
  return {status:200,text:`<!doctype html><h1>${job.title}</h1><script type="application/ld+json">${JSON.stringify(job)}</script>`};
}
