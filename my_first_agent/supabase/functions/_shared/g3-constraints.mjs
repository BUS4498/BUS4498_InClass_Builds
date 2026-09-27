// Compare only explicit, directly comparable values. Unrecognized language
// stays unknown; these functions never infer work authorization or relocation.
export function g3ValidDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
const cNorm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
export function g3ConstraintFindings(bundle,at=new Date().toISOString()) {
  const p=bundle.posting,s=bundle.scope,f=s.optional_facts||{},out=[];
  const add=(field,status,explanation,refs=[],owner=null,hard=false)=>out.push({field,status,explanation,refs,unknown_owner:owner,hard});
  const factRef=name=>`student:optional:${name}`;
  if(g3ValidDate(p.start_date))add('start_date',p.start_date>=s.start_date&&p.start_date<=s.end_date?'matched':'conflict','Compare the stated start date with the confirmed start-date search range.',['posting:start_date','scope:timeframe'],null,true);
  else add('start_date','unknown','The posting does not state a valid exact start date. A year or season supports initial relevance only.',['scope:timeframe'],'source');
  if(g3ValidDate(p.deadline?.slice(0,10))){
    const deadline=p.deadline.slice(0,10),days=Math.round((Date.parse(deadline+'T00:00:00Z')-Date.parse(at.slice(0,10)+'T00:00:00Z'))/86400000);
    add('deadline',days<0?'conflict':'matched',`Stated deadline ${deadline}: ${days<0?'already passed':days===0?'today; employer cutoff time is unknown':`${days} calendar days away`}. Confirm the employer's cutoff before acting.`,['posting:deadline'],null,true);
  } else add('deadline','unknown','The employer deadline is absent or cannot be interpreted as a valid calendar date.',[],'source');
  add('availability',p.availability==='closed'?'conflict':p.availability==='open'?'matched':'unknown',p.availability==='open'?'The supplied posting explicitly establishes open availability.':'A readable posting does not establish that applications are still open.',['posting:availability'],!['open','closed'].includes(p.availability)?'source':null,true);

  const locations=Array.isArray(f.available_locations)?f.available_locations:[];
  if(p.location&&locations.length){
    const exact=p.location.split(';').some(place=>locations.some(v=>cNorm(v)===cNorm(place)));
    add('location',exact?'matched':'unknown',exact?'An exact posting location appears in the student-confirmed available locations.':'Location labels do not match exactly. Confirm the geographic comparison; no relocation is assumed.',['posting:location',factRef('available_locations')],exact?null:'student');
  }else add('location','unknown',p.location?'A location preference alone does not confirm availability at the posting location.':'The posting location is not stated.',p.location?['posting:location']:[],p.location?'student':'source');
  add('work_arrangement',p.remote===true&&f.remote_available===true?'matched':'unknown',p.remote===true?'The posting states remote work. Location restrictions and the student’s ability to work remotely require separate confirmation.':'The posting does not establish a supported work arrangement.',p.remote===true?['posting:remote',...(f.remote_available!==undefined?[factRef('remote_available')]:[])]:[],p.remote===true&&f.remote_available!==true?'student':p.remote===true?null:'source');

  const hours=String(p.work_hours||'').match(/^\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s+hours?(?:\s+per\s+week|\s*\/\s*week)\s*$/i);
  if(hours&&Number(hours[1])<=Number(hours[2]||hours[1])&&Number(hours[2]||hours[1])<=168){
    const low=Number(hours[1]),high=Number(hours[2]||hours[1]),available=f.available_hours_per_week;
    const known=typeof available==='number'&&Number.isFinite(available)&&available>=0&&available<=168;
    const status=!known?'unknown':available<low?'conflict':available>=high?'matched':'unknown';
    add('hours',status,`Posting: ${p.work_hours}. ${known?`Student available: ${available} hours per week.`:'Student weekly availability is unknown.'}${known&&available>=low&&available<high?' The posting range needs clarification.':''}`,['posting:work_hours',...(known?[factRef('available_hours_per_week')]:[])],status==='unknown'?known?'source':'student':null,true);
  }else add('hours','unknown','The posting does not supply an unambiguous weekly-hours value. Narrative or conditional hours require clarification.',p.work_hours?['posting:work_hours']:[],'source');

  // These narrow phrases establish only a US work-authorization requirement.
  // Citizenship, sponsorship, immigration status, or employer exceptions are
  // not inferred from it or from the student's resume.
  const authRefs=bundle.refs.filter(r=>r.kind==='posting'&&/\bmust (?:be (?:legally )?authorized|have (?:legal )?authorization) to work in (?:the )?(?:United States|U\.S\.|USA)\b/i.test(r.text));
  if(authRefs.length){
    const known=typeof f.authorized_to_work_us==='boolean';
    add('work_authorization',known?f.authorized_to_work_us?'matched':'conflict':'unknown','The posting explicitly requires US work authorization. Compare only the student’s direct confirmation; sponsorship or other eligibility rules remain separate.',[authRefs[0].id,...(known?[factRef('authorized_to_work_us')]:[])],known?null:'student',true);
  }else add('work_authorization','unknown','No unambiguous authorization comparison is available. This does not establish legal eligibility.',[],'source');

  let salary;try{salary=typeof p.compensation==='string'?JSON.parse(p.compensation):p.compensation;}catch{}
  const amount=salary?.value,currency=salary?.currency,unit=amount?.unitText;
  const low=typeof amount==='number'?amount:amount?.minValue??amount?.value,high=typeof amount==='number'?amount:amount?.maxValue??amount?.value;
  const pay=f.minimum_hourly_pay;
  if(unit==='HOUR'&&typeof low==='number'&&typeof high==='number'&&low>=0&&high>=low&&pay&&typeof pay.amount==='number'&&pay.currency===currency){
    const status=high<pay.amount?'conflict':low>=pay.amount?'matched':'unknown';
    add('compensation',status,`Posting hourly range: ${low}–${high} ${currency}; confirmed minimum: ${pay.amount} ${currency}. ${status==='unknown'?'The range straddles the minimum; the offered amount is unknown.':'No currency or annual-to-hourly conversion was used.'}`,['posting:compensation',factRef('minimum_hourly_pay')],status==='unknown'?'source':null,true);
  }else add('compensation','unknown','Pay requires a stated amount and unit plus a directly comparable student minimum. No pay preference is inferred.',p.compensation?['posting:compensation']:[],p.compensation&&!pay?'student':'source');
  if(s.hard_constraints?.length)add('hard_constraints','unknown','A stated hard constraint needs a direct comparison; it cannot be relaxed automatically.',[],'student',true);
  return out;
}
