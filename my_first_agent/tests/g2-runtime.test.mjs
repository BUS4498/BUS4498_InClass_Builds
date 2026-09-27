import test from 'node:test';
import assert from 'node:assert/strict';
import { g2Harness,finishFixture } from './g2-memory-harness.mjs';
test('full synthetic controller persists every disposition, a question, and read-back checked XLSX without network',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden in synthetic mode');};
 try{const {api,db}=g2Harness();const run=await finishFixture(api);
 assert.equal(run.status,'awaiting_student');assert.equal(run.ledger_status,'verified');assert.equal(run.export_status,'verified');assert.equal(run.counters.api_attempts,5);assert.equal(run.counters.hosted_observed,0);assert.equal(run.counters.leads,6);assert.equal(run.counters.reads,5);assert.equal(db.ledger.length,6);assert.equal(db.questions.length,1);
 const dl=await (await api.download_discovery_export('student-a',{exportId:run.export_id})).json();assert.equal(dl.ok,true);assert.equal(Buffer.from(dl.base64,'base64').subarray(0,2).toString(),'PK');
 const answer=await (await api.answer_validation_question('student-a',{questionId:db.questions[0].id,responseKind:'unavailable',answer:'Synthetic answer: I do not know.'})).json();assert.equal(answer.question.status,'still_unresolved');
 }finally{globalThis.fetch=old;}
});
test('unchanged second run preserves versions and prior snapshot bytes',async()=>{
 const {api,db}=g2Harness();const first=await finishFixture(api),oldBytes=Buffer.from(db.files.values().next().value);const second=await finishFixture(api);
 assert.equal(second.export_version,2);assert.equal(second.export_row_count,12);assert.deepEqual(Buffer.from(db.files.values().next().value),oldBytes);assert.equal(second.candidates.filter(r=>r.disposition==='excluded_unchanged').length,2);
});
test('other owner cannot read runs, export files, or answer questions using copied IDs',async()=>{
 const {api,db}=g2Harness(),run=await finishFixture(api);
 assert.equal((await (await api.list_discoveries('student-b',{runId:run.id})).json()).runs.length,0);
 assert.equal((await api.step_discovery('student-b',{runId:run.id,expectedRevision:run.revision})).status,404);
 assert.equal((await api.download_discovery_export('student-b',{exportId:run.export_id})).status,404);
 assert.equal((await api.answer_validation_question('student-b',{questionId:db.questions[0].id,responseKind:'answer',answer:'forged'})).status,404);
});
test('same start ID is idempotent, overlapping new start and stale step cannot repeat work',async()=>{
 const {api,db}=g2Harness(),payload={requestKey:crypto.randomUUID(),mode:'synthetic'};
 const a=await (await api.start_discovery('a',payload)).json();await api.start_discovery('a',payload);assert.equal(db.runs.length,1);
 assert.equal((await api.start_discovery('a',{...payload,requestKey:crypto.randomUUID()})).status,409);
 assert.equal((await api.step_discovery('a',{runId:a.run.id,expectedRevision:99})).status,409);assert.equal(db.runs[0].state.counters.api_attempts,0);
});
test('unknown inflight action stops without retry',async()=>{
 const {api,db}=g2Harness();const a=await (await api.start_discovery('a',{requestKey:crypto.randomUUID(),mode:'synthetic'})).json();
 db.runs[0].state.inflight={kind:'search',started_ms:Date.now()-40000};const result=await (await api.step_discovery('a',{runId:a.run.id,expectedRevision:0})).json();assert.equal(result.run.status,'operationally_incomplete');assert.equal(result.run.counters.api_attempts,0);
});
test('export failure preserves committed ledger and blocks completion/download',async()=>{
 const {api,db}=g2Harness({failUpload:true}),run=await finishFixture(api);assert.equal(run.status,'operationally_incomplete');assert.equal(run.ledger_status,'verified');assert.equal(run.export_status,'failed_or_unknown');assert.equal(db.ledger.length,6);assert.equal(run.export_id,null);
});
test('export checksum mismatch blocks completion',async()=>{const {api}=g2Harness({corruptDownload:true}),run=await finishFixture(api);assert.equal(run.status,'operationally_incomplete');assert.match(run.issues.join(' '),/CHECKSUM/);});
test('systemic provider failure consumes one attempt, does not retry, and saves an empty honest incomplete result',async()=>{
 const {api}=g2Harness({keyPresent:true});const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('fixture error',{status:503});};
 try{const run=await finishFixture(api,'a','live');assert.equal(calls,1);assert.equal(run.counters.api_attempts,1);assert.equal(run.status,'operationally_incomplete');assert.equal(run.candidates.length,0);assert.equal(run.export_status,'verified');}finally{globalThis.fetch=old;}
});
