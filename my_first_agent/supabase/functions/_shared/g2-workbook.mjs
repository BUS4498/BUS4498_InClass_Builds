// Portable XLSX writer for the Edge runtime. Every supplied value is a literal
// cell; job text can never create a spreadsheet formula or external data link.
const utf8 = new TextEncoder();
const xml = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const column = n => { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; };
const concat = parts => { const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0)); let i=0; for(const b of parts){out.set(b,i);i+=b.length;}return out; };
const crcTable = Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32 = bytes => {let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
export function g2Zip(files) {
  const local=[],central=[];let offset=0;
  for(const [name,text] of Object.entries(files)) {
    const n=utf8.encode(name),b=text instanceof Uint8Array?text:utf8.encode(text),crc=crc32(b),h=new Uint8Array(30),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);
    local.push(h,n,b);
    const c=new Uint8Array(46),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,b.length,true);d.setUint32(24,b.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);central.push(c,n);offset+=h.length+n.length+b.length;
  }
  const cd=concat(central),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,Object.keys(files).length,true);ev.setUint16(10,Object.keys(files).length,true);ev.setUint32(12,cd.length,true);ev.setUint32(16,offset,true);
  return concat([...local,cd,end]);
}
function g2Sheet(title,note,headers,rows,widths=null) {
  const all=[[title],[note],[],headers,...rows];
  const rowXml=all.map((r,i)=>`<row r="${i+1}" ht="${i===0?30:i===1?36:i===2?12:i===3?44:Math.min(widths?409:132,Math.max(48,...r.map((v,j)=>(widths?String(v??'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(widths[j]*.85))),0):Math.ceil(String(v??'').length/25))*14+12)))}" customHeight="1">${r.map((v,j)=>{
    const ref=`${column(j)}${i+1}`,style=i===0?2:i===3?1:0;
    return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="45"/><cols>${widths?widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join(''):`<col min="1" max="${headers.length}" width="25" customWidth="1"/>`}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A4:${column(headers.length-1)}${Math.max(4,all.length)}"/><mergeCells count="2"><mergeCell ref="A1:${column(Math.min(headers.length-1,5))}1"/><mergeCell ref="A2:${column(Math.min(headers.length-1,8))}2"/></mergeCells></worksheet>`;
}
export function g2Workbook(state, ledger, version) {
  const opportunityHeaders=['Run ID','Candidate ID','Opportunity ID','Employer or agency','Role','Role type','Source category','Lead URL','Checked posting URL','Posting ID','Source status','Disposition','Disposition reason','Location and work mode','Role period','Posting date','Deadline','Pay','First seen','Last seen','Checked at','Resume version','Posting evidence version','Evidence record ref','Fit score','Fit lower fraction','Fit upper fraction','Eligibility','Readiness','Next step','Question or draft ref','Record version','Summary group','Stable rank','Suggested action','Student decision'];
  const opportunities=ledger.map(row=>{const r=row.record,p=r.posting||{},a=r.assessment,s=a?.score;return [row.run_id,r.candidate_id,row.opportunity_id,p.employer,p.role||r.title,p.role_type,r.source,r.url,p.url,p.job_id,r.access,r.disposition,r.reason,p.location,p.start_date||'Exact start unknown',p.posted_date,p.deadline,p.compensation,r.first_seen||row.created_at,r.last_seen||row.created_at,p.checked_at,r.resume_version??'Unknown',p.checked_at||row.version_number,row.id,s?.label||'',s?.fraction_lower??'',s?.fraction_upper??'',a?.eligibility||r.eligibility,a?.readiness||r.readiness,r.next_step,r.preparation?JSON.stringify(r.preparation):r.question||(r.questions||[]).map(q=>q.case_key).join('; '),row.version_number,r.presentation?.group||'',r.presentation?.rank??'',r.recommendation?.action||'Not completed','Not supplied'];});
  const c=state.counters;
  const sheets=[
    ['Opportunities','Job opportunities',`${state.mode==='synthetic'?'SYNTHETIC TEST DATA. ':''}Snapshot ${version}. All screened dispositions; blank assessment fields mean not assessed.`,opportunityHeaders,opportunities],
    ['Runs','Search runs',state.g3?'Fit is not eligibility, readiness, offer probability, or application approval. Recommendations are advice only.':'G2 records discovery and storage only. Fitness assessment and email are not performed.',
      ['Run ID','Trigger','Started at','Recorded at','Scope version','Discovery API attempts','Leads screened','Direct posting reads','Pages skipped','Scored shown','Needs info shown','Run status','Spreadsheet read-back','Digest status','Notes','Hosted calls reserved','Hosted calls observed','Snapshot version','Completed scored metric','T4 requests','T4 tools','T5 requests'],
      [[state.id,state.trigger||'manual',state.started_at,state.recorded_at,state.scope.version_number,c.api_attempts,c.leads,c.reads,c.skipped,state.ranking?.ranked_shown||0,state.ranking?.needs_shown||0,state.incomplete?'Operationally incomplete':state.g3?'Assessed and logged':'Discovery logged; fitness pending','Download offered only after read-back','Not requested',[...state.issues,state.ranking?.shortfall||state.stopping_reason].filter(Boolean).join('; '),c.hosted_reserved,c.hosted_observed,version,(state.trigger==='targeted_update'?0:state.ranking?.scored_total||0),state.g3?.model_calls||0,state.g3?.tool_calls||0,state.g3?.recommendation_calls||0]]],
    ['Source Coverage','Source coverage','Query strings are shown only when returned by the provider. These counts do not describe internal provider retrievals.',
      ['Run ID','Source category','Access status','Route','Attempts','Skip or failure reason','Checked at','Leads','Direct posting reads','Verified postings','Requested search intent','Observed provider queries'],
      state.plan.map(p=>[state.id,p.name,p.status,p.route||'',p.attempts,p.reason||'',p.checked_at||'',p.leads,p.reads,p.verified,p.intent,p.queries===null?'Not supplied by provider':p.queries.join('\n')])],
    ['Manifest','Snapshot manifest','Stable ledger row IDs included in this file.', ['Run ID','Snapshot version','Ledger row ID'],ledger.map(r=>[r.run_id,version,r.id])],
  ];
  if(ledger.some(row=>row.record.assessment)){
    const citations=items=>(items||[]).map(e=>`${e.id} | ${e.reference} | ${e.quote}`).join('\n');
    sheets.push(['Fit Evidence','Criterion evidence','Only cited comparison excerpts are exported. Missing student evidence is unknown, not a qualification gap.',
      ['Ledger row','Candidate','Criterion','Type','Weight','Comparison','Earned lower','Earned upper','Posting evidence','Student evidence','Missing evidence','Unknown owner','Explanation'],
      ledger.flatMap(row=>[...(row.record.assessment?.criteria||[]).map(k=>[row.id,row.record.candidate_id,k.label,k.type,k.weight,k.status,k.earned_lower,k.earned_upper,citations(k.posting),citations(k.student),k.missing,k.unknown_owner,k.explanation]),...(row.record.assessment?.constraints||[]).map(k=>[row.id,row.record.candidate_id,k.field,'constraint','',k.status,'','',citations((k.evidence||[]).filter(e=>e.kind==='posting')),citations((k.evidence||[]).filter(e=>e.kind!=='posting')),k.status==='unknown'?k.explanation:'',k.unknown_owner,k.explanation])]),[36,40,32,14,12,20,14,14,70,65,50,14,55]]);
    sheets.push(['Questions','Student questions at snapshot time','Answers are saved separately as append-only history. This immutable download does not change after a later answer.',
      ['Ledger row','Candidate','Case key','Question','Why needed','Answer type','Resume version','Scope version','Posting version','Employer deadline','Status'],
      ledger.flatMap(row=>(row.record.questions||[]).map(q=>[row.id,row.record.candidate_id,q.case_key,q.question,q.need,q.answer_type,q.resume_version,q.scope_version,q.posting_version,q.posting_deadline,q.status])),[36,40,44,65,50,18,14,14,26,22,20]]);
    sheets.push(['Next Steps','Next steps and constraints','Suggestions do not create drafts, change a student decision, send a message or submit an application.',
      ['Ledger row','Candidate','Suggested action','Reason','Next step','Preparation suggestions','Constraints and unknowns','Subtasks performed'],
      ledger.filter(row=>row.record.assessment).map(row=>{const r=row.record;return [row.id,r.candidate_id,r.recommendation?.action||'Not completed',r.recommendation?.reason,r.next_step,(r.recommendation?.suggestions||[]).map(s=>`${s.type}: ${s.reason}`).join('\n'),(r.assessment.constraints||[]).map(c=>`${c.field} | ${c.status} | ${c.explanation}`).join('\n'),(r.assessment.subtasks||[]).map(s=>`${s.name}: ${s.summary}`).join('\n')];}),[36,40,20,48,52,66,90,70]]);
  }
  const files={};
  files['[Content_Types].xml']=`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels']='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files['xl/workbook.xml']=`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${s[0]}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels']=`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml']='<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF142E45"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142E45"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=g2Sheet(...s.slice(1)));
  return g2Zip(files);
}
export function g2WorkbookManifest(bytes) {
  const decoder=new TextDecoder();let offset=0;
  while(offset+30<=bytes.length){const d=new DataView(bytes.buffer,bytes.byteOffset+offset);if(d.getUint32(0,true)!==0x04034b50)break;
    const size=d.getUint32(18,true),nameSize=d.getUint16(26,true),extra=d.getUint16(28,true),start=offset+30+nameSize+extra;
    const name=decoder.decode(bytes.subarray(offset+30,offset+30+nameSize));
    if(name==='xl/worksheets/sheet4.xml')return decoder.decode(bytes.subarray(start,start+size));offset=start+size;
  }throw new Error('XLSX_MANIFEST_MISSING');
}
