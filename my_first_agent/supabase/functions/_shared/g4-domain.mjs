import {g3Evidence,g3Citations} from './g3-domain.mjs';
export const G4_TYPES=['resume_tailoring','cover_letter','interview_cards'];
export const G4_LABEL='DRAFT TEMPLATE — STUDENT REVIEW REQUIRED';
export const G4_SECTIONS=['EDUCATION','WORK EXPERIENCE','LEADERSHIP & INVOLVEMENT','SKILLS & HONORS'];
export const G4_SLOTS=['student_name','student_confirmed_contact_line','school_name','school_location','degree_and_major','education_dates','supported_academic_detail_with_resume_reference','relevant_coursework_with_resume_reference','employer_name','work_location','position_title','work_dates','supported_experience_bullet_with_resume_and_posting_references','organization_name','activity_location','leadership_role','activity_dates','supported_leadership_bullet_or_student_completion_prompt','confirmed_product_and_project_skills','confirmed_data_and_technical_skills','confirmed_honors_or_omit_line','student_approved_opening_with_verified_role_and_interest','evidence_grounded_example_with_resume_and_posting_references','second_supported_example_or_student_completion_prompt','student_approved_closing_without_unverified_claims'];
export const g4Uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
const g4Fail=s=>{throw Error(s);};
export function g4Bundle(s){
 if(s.trigger!=='targeted_update'||s.results?.length!==1||!G4_TYPES.includes(s.preparation_request?.artifact_type)||s.counters.api_attempts!==0||s.counters.hosted_reserved!==0)g4Fail('EXPLICIT_SINGLE_TARGET_REQUIRED');
 const c=s.results[0];if(c.assessment?.status!=='completed'||!c.recommendation)g4Fail('COMPLETED_ASSESSMENT_AND_RECOMMENDATION_REQUIRED');
 const bundle=g3Evidence(c,s.g3_context);if(!bundle.refs.some(x=>x.kind==='student'&&x.id.startsWith('resume:')||x.id.startsWith('student:summary:')))g4Fail('CONFIRMED_RESUME_EVIDENCE_REQUIRED');
 return {...bundle,opportunity_id:c.opportunity_id,run_id:s.id,artifact_type:s.preparation_request.artifact_type,request:s.preparation_request,assessment:c.assessment,recommendation:c.recommendation};
}
export function g4Validate(output,bundle){
 if(!output||!Array.isArray(output.fields)||!Array.isArray(output.cards)||output.fields.length>60||output.cards.length>8)g4Fail('DRAFT_STRUCTURE_INVALID');
 const fact=(x)=>{if(!x||typeof x.text!=='string'||x.text.length>1500||!['fact','placeholder'].includes(x.kind))g4Fail('DRAFT_ITEM_INVALID');const citations=g3Citations(x.citations,bundle,['student','posting']);if(x.kind==='fact'&&!citations.some(c=>c.quote===x.text&&bundle.refs.find(r=>r.id===c.id)?.kind==='student'))g4Fail('DRAFT_FACT_MUST_BE_EXACT_SUPPORTED_EXCERPT');if(x.kind==='placeholder'&&(!x.text.startsWith('STUDENT TO COMPLETE:')||citations.length))g4Fail('PLACEHOLDER_MUST_BE_EXPLICIT');return {text:x.text,kind:x.kind,citations};};
 const seen=new Set(),fields=output.fields.map(x=>{const item=x.item??0,key=x.slot+':'+x.entry+':'+item;if(!G4_SLOTS.includes(x.slot)||!Number.isInteger(x.entry)||x.entry<0||x.entry>5||!Number.isInteger(item)||item<0||item>5||seen.has(key)||(item>0&&!/bullet|coursework|academic_detail|example/.test(x.slot)))g4Fail('DRAFT_SLOT_INVALID');seen.add(key);return{slot:x.slot,entry:x.entry,item,...fact(x)};});
 const cards=output.cards.map((x,i)=>{if(typeof x.question!=='string'||x.question.length<12||x.question.length>400||!Array.isArray(x.themes)||!x.themes.length||x.themes.length>4)g4Fail('CARD_INVALID');const posting=g3Citations(x.posting,bundle,['posting']);if(!posting.length||posting[0].quote.length>240)g4Fail('CARD_REQUIRES_EXACT_POSTING_TOPIC');return{id:'card-'+(i+1),question:x.question,source_topic:posting[0].quote,posting,themes:x.themes.map(fact)};});
 if(bundle.artifact_type==='interview_cards'?(fields.length||cards.length<3):(!fields.length||cards.length))g4Fail('WRONG_REQUESTED_ARTIFACT');
 const allowed=bundle.artifact_type==='cover_letter'?G4_SLOTS.filter(x=>x.startsWith('student_approved_')||x.includes('example_')||['student_name','student_confirmed_contact_line'].includes(x)):G4_SLOTS.filter(x=>!x.startsWith('student_approved_')&&!x.includes('example_'));
 if(bundle.artifact_type!=='interview_cards'&&!fields.some(x=>x.kind==='fact'))g4Fail('SUPPORTED_DRAFT_FACT_REQUIRED');
 if(fields.some(x=>!allowed.includes(x.slot)))g4Fail('WRONG_ARTIFACT_SLOT');
 return{fields,cards,origin:'model_draft',label:G4_LABEL,claim_policy:'Factual draft text uses checked source excerpts. Student revisions are separately attributed.',unknowns:[...new Set([!bundle.posting.deadline?'UNKNOWN: posting does not state a deadline.':null,...(bundle.assessment.gaps||[]).map(x=>`UNKNOWN: ${x.need}`)].filter(Boolean))]};
}
export function g4StudentRevision(previous,payload){
 if(payload?.confirmedAuthorship!==true||!payload.content||!Array.isArray(payload.content.fields)||!Array.isArray(payload.content.cards))g4Fail('STUDENT_AUTHORSHIP_REQUIRED');
 const next=structuredClone(previous);const clean=v=>{if(typeof v!=='string'||v.length>1500)g4Fail('REVISION_TEXT_INVALID');return v.trim();};
 if(payload.content.fields.length!==previous.fields.length||payload.content.cards.length!==previous.cards.length)g4Fail('REVISION_STRUCTURE_CHANGED');
 next.fields=previous.fields.map((x,i)=>({...x,text:clean(payload.content.fields[i].text),kind:'student_authored',citations:x.text===payload.content.fields[i].text?x.citations:[],previous_text:x.text}));
 next.cards=previous.cards.map((x,i)=>{const c=payload.content.cards[i];if(c.themes.length!==x.themes.length)g4Fail('CARD_STRUCTURE_CHANGED');return{...x,question:clean(c.question),themes:x.themes.map((t,j)=>({...t,text:clean(c.themes[j].text),kind:'student_authored',citations:t.text===c.themes[j].text?t.citations:[],previous_text:t.text}))};});
 next.origin='student_revision';next.label=G4_LABEL;return next;
}
export function g4Blockers(content){return [...content.fields.filter(x=>['student_name','student_confirmed_contact_line'].includes(x.slot)&&!x.text.trim()).map(x=>'Missing '+x.slot),...content.cards.filter(c=>!c.question.trim()||!c.themes.some(t=>t.text.trim())).map(()=> 'Missing card question or answer theme'),...content.fields.map(x=>x.text),...content.cards.flatMap(x=>[x.question,...x.themes.map(t=>t.text)])].filter(x=>/STUDENT TO COMPLETE:|\{\{|\[insert|\bTODO\b|^Missing /i.test(x));}
export function g4ReviewCheck(content,p){
 if(!['approve','request_changes','decline'].includes(p?.decision)||typeof p.intendedUse!=='string'||!p.intendedUse.trim()||p.intendedUse.length>500||typeof p.comments!=='string'||p.comments.length>3000)g4Fail('REVIEW_DETAILS_REQUIRED');
 if(p.decision==='approve'&&(g4Blockers(content).length||p.factsConfirmed!==true||p.placeholdersResolved!==true||p.unresolvedClaims!==false))g4Fail('COMPLETE_PLACEHOLDERS_AND_CONFIRM_FACTS_BEFORE_APPROVAL');
 if(p.decision!=='approve'&&!p.comments.trim())g4Fail('REVIEW_REASON_REQUIRED');return true;
}
export function g4Fixture(bundle){
 const ref=bundle.refs.find(x=>x.kind==='student'&&x.text.includes('Course project: used Excel'))||bundle.refs.find(x=>x.kind==='student'&&x.id.startsWith('resume:'));
 const item={text:ref.text,kind:'fact',citations:[{id:ref.id,quote:ref.text}]};
 if(bundle.artifact_type==='interview_cards'){const p=bundle.refs.find(x=>x.kind==='posting'&&x.text.includes('coursework'))||bundle.refs.find(x=>x.kind==='posting');const quote=p.text.match(/[^.!?]*coursework required\./i)?.[0].trim()||p.text.slice(0,100);return{fields:[],cards:['How would you demonstrate','What example could you discuss for','What would you practice to strengthen'].map(q=>({question:`${q} this requirement: ${quote}?`,posting:[{id:p.id,quote}],themes:[item,{kind:'placeholder',text:'STUDENT TO COMPLETE: add your own verified situation, action, and result.',citations:[]}]}))};}
 return{fields:bundle.artifact_type==='resume_tailoring'?[{slot:'relevant_coursework_with_resume_reference',entry:0,...item}]:[{slot:'evidence_grounded_example_with_resume_and_posting_references',entry:0,...item}],cards:[]};
}
