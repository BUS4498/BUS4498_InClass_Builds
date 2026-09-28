// Qualifier context must come from the same exact source passage. A heading
// ends at the next heading; words elsewhere in a posting cannot qualify a quote.
const required = /\b(required|requirements?|mandatory|must|minimum|at least|essential|need to|shall)\b/i;
const preferred = /\b(preferred|desirable|nice to have|a plus|bonus|ideally)\b/i;
const headingPattern = /\b(?:[A-Z][A-Z &/()-]{2,80}|Required Qualifications|Minimum Qualifications|Preferred Qualifications|Basic Qualifications|Requirements|Qualifications|Education Requirement|Additional Information|Responsibilities|Duties|Benefits|Transcript Upload Instructions)\s*:/g;
function directType(text) {
  if(/\b(not required|not mandatory|no .{0,35}required|if required)\b/i.test(text))return 'unclear';
  const r=required.test(text),p=preferred.test(text);
  return r===p?'unclear':p?'preferred':'required';
}
function sections(text) {
  const headings=[...text.matchAll(headingPattern)],out=[];
  if(!headings.length)return [{text,start:0,heading:null,type:'unclear'}];
  if(headings[0].index)out.push({text:text.slice(0,headings[0].index),start:0,heading:null,type:'unclear'});
  for(let i=0;i<headings.length;i++){
    const h=headings[i],start=h.index+h[0].length;
    out.push({text:text.slice(start,headings[i+1]?.index??text.length),start,heading:h[0],type:directType(h[0])});
  }
  return out;
}
function fragments(text) {
  // Numbered lists often arrive flattened by JSON-LD. Do not split decimal GPAs.
  return text.split(/(?<=[.!?])\s+(?=[A-Z])|\n|;|(?:^|\s)\d{1,2}[.)]\s+(?=[A-Z])/).map(s=>s.trim()).filter(Boolean);
}
function gpaCondition(text){
  if(!/\bGPA\b/i.test(text))return null;
  const values=text.match(/\b\d+\.\d+\b/g)||[];
  return values.length===1?`${values[0]}|${/fall semester/i.test(text)?'fall':'general'}`:null;
}
export function g3RequirementCovered(unit,quote){
  // Two standard source phrasings of the same enrollment qualification.
  // Only the basic degree-list sentence is aliased; dates, intensity, grades,
  // exceptions and other conditions still require their own literal coverage.
  const words=unit.toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).filter(Boolean);
  const allowed=new Set('they must be in attendance at and enrolled a an the incumbent degree program graduate baccalaureate bachelor associate or'.split(' '));
  if(!words.includes('enrolled')||words.some(w=>!allowed.has(w)))return false;
  const types=['graduate','associate','baccalaureate','bachelor'].filter(t=>words.includes(t));
  return types.length>0&&/\benrolled\b/i.test(quote)&&types.every(t=>t==='baccalaureate'||t==='bachelor'?/\b(baccalaureate|bachelor)\b/i.test(quote):new RegExp(`\\b${t}\\b`,'i').test(quote));
}
export function g3QualifierSupport(cite,bundle) {
  const ref=bundle.refs.find(r=>r.id===cite.id);
  if(!ref)return {type:'unclear',context:null};
  const at=ref.text.indexOf(cite.quote),section=sections(ref.text).find(s=>at>=s.start&&at<s.start+s.text.length);
  const direct=directType(cite.quote);
  if(direct!=='unclear')return {type:direct,context:null};
  // An explicit negation or preference cannot inherit a mandatory heading.
  if(required.test(cite.quote)||preferred.test(cite.quote)||/\b(may|can|optional)\b/i.test(cite.quote))return {type:'unclear',context:null};
  if(section&&at+cite.quote.length<=section.start+section.text.length&&section.type!=='unclear')
    return {type:section.type,context:{id:ref.id,quote:section.heading,reference:ref.reference}};
  return {type:'unclear',context:null};
}
export function g3QualificationCatalog(bundle) {
  const out=[],seen=new Set();
  for(const ref of bundle.refs.filter(r=>r.kind==='posting'&&(r.id==='posting:description'||r.id.startsWith('posting:criterion:')))){
    for(const section of sections(ref.text))for(const quote of fragments(section.text)){
      const type=g3QualifierSupport({id:ref.id,quote},bundle).type;
      const background=section.heading&&/additional information|responsibilities|duties|benefits|instructions/i.test(section.heading);
      if(quote.length<6||/^for this particular job|^online resumes must demonstrate qualification/i.test(quote))continue;
      // Optional ways to supply a document and repeated consequences of the
      // same GPA condition are guidance, not additional qualifications/weights.
      if(/\b(?:may|can) (?:provide|upload|submit)\b/i.test(quote))continue;
      if(/\boffers? rescinded\b/i.test(quote)&&gpaCondition(quote)&&out.some(u=>gpaCondition(u.quote)===gpaCondition(quote)))continue;
      if((ref.id==='posting:description'||background)&&!required.test(quote)&&!preferred.test(quote))continue;
      const key=quote.toLowerCase().replace(/\W+/g,' ').trim();if(seen.has(key))continue;seen.add(key);
      out.push({id:ref.id,quote,type,heading:section.heading});
    }
  }
  return out;
}
