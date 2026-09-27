import test from 'node:test';import assert from 'node:assert/strict';
import {g2ParsePosting,g2SearchSources,g2LeadLabel,g2Validate} from '../supabase/functions/_shared/g2-domain.mjs';
import {libraryItem} from '../supabase/functions/_shared/opportunity-library.mjs';
const time='2026-09-27T23:00:00Z',url='https://job-boards.greenhouse.io/synthetic/jobs/123456';
const job={post_type:'job_post',title:'Data Analytics Intern Summer 2027',company_name:'Synthetic Employer',content:'<p>Use SQL to analyze data. Summer 2027 internship.</p>',public_url:url,location:'Boston, MA',published_at:'2026-09-01T12:00:00Z'};
const greenhouse=j=>'<script>window.__remixContext = '+JSON.stringify({state:{loaderData:{jobRoute:{jobPost:j}}}})+';</script>';
test('Greenhouse embedded job data is read without executing scripts and stays tied to the exact employer board and job ID',()=>{
 const p=g2ParsePosting(greenhouse(job),url+'?gh_jid=123456&t=gh_src%3D','employer ATS',time);assert.equal(p.ok,true);assert.equal(p.posting.employer,'Synthetic Employer');assert.equal(p.posting.location,'Boston, MA');assert.match(p.posting.description,/SQL/);assert.equal(p.posting.source_format,'Greenhouse embedded jobPost');
 for(const altered of [{...job,public_url:url.replace('123456','654321')},{...job,public_url:url.replace('synthetic/','other/')},{...job,company_name:''}])assert.equal(g2ParsePosting(greenhouse(altered),url,'employer ATS',time).ok,false);
 assert.equal(g2ParsePosting(greenhouse(job)+'<script>alert("untrusted")</script>',url,'employer ATS',time).ok,true);
 assert.equal(g2ParsePosting('<script>window.__remixContext = fetch("https://evil.example")</script>',url,'employer ATS',time).ok,false);
});
test('USAJOBS encoded MIME type, string employer, US posted date and open deadline are accepted as source evidence',()=>{
 const j={'@type':'JobPosting',title:'Summer 2027 Data Analytics Internship',hiringOrganization:'SYNTHETIC AGENCY',description:'Internship in data analytics during Summer 2027.',datePosted:'08/31/2026',validThrough:'2026-09-30'};
 const p=g2ParsePosting('<script type="application/ld&#x2B;json">'+JSON.stringify(j)+'</script>','https://www.usajobs.gov/job/123456','official USAJOBS',time);assert.equal(p.ok,true);assert.equal(p.posting.posted_date,'2026-08-31');assert.equal(p.posting.availability,'open');
 const r=g2Validate({access:'readable',posting:p.posting},{role_types:['internship'],role_interests:['data analytics'],start_date:'2027-06-01',end_date:'2027-08-31'});assert.equal(r.disposition,'verified_new');
 assert.equal(g2ParsePosting('<script type="application/ld+json">'+JSON.stringify({...j,validThrough:'2026-09-01'})+'</script>','https://www.usajobs.gov/job/123456','official USAJOBS',time).posting.availability,'closed');
});
test('citation titles label existing search sources but neither titles nor extra citation URLs create verified jobs',()=>{
 const u='https://www.indeed.com/viewjob?jk=abc',r=g2SearchSources({status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{url:u}]}},{type:'message',content:[{annotations:[{type:'url_citation',url:u,title:'Synthetic intern listing'},{type:'url_citation',url:'https://evil.example',title:'extra'}]}]}]});assert.deepEqual(r.sources,[{url:u,title:'Synthetic intern listing'}]);assert.equal(r.sources[0].posting,undefined);
});
test('saved unchecked leads get distinct labels, direct links and failure reasons without inventing an employer',()=>{
 const r={url:'https://www.indeed.com/viewjob?jk=abc',source:'Indeed',title:'',access_reason:'Source could not be read',disposition:'excluded_unverified'};
 const item=libraryItem({opportunity_id:'x',data_mode:'live',record:r,created_at:time},v=>v);assert.equal(item.source_checked,false);assert.equal(item.employer,null);assert.equal(item.url,r.url);assert.equal(item.reason,r.access_reason);assert.match(item.role,/Indeed lead · abc/);
 assert.equal(g2LeadLabel({...r,url:'https://www.indeed.com/viewjob?jk=xyz'}).endsWith('xyz'),true);
 const checked=libraryItem({record:{...r,posting:{role:'Intern',employer:'Synthetic',checked_at:time}},data_mode:'live'},v=>v);assert.equal(checked.source_checked,true);
});
