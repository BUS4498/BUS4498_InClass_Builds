import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../app/worker/index.mjs';
test('every discovery route rejects signed-out and cross-origin requests',async()=>{
 const origin='https://career.example',env={G1_GATEWAY_SECRET:'fixture-only',SUPABASE_G1_URL:'https://fixture.example/function'};
 for(const route of ['start','step','runs','download','answer']){
  const url=`${origin}/api/g2/${route}`;
  assert.equal((await worker.fetch(new Request(url,{method:'POST',body:'{}'}),env)).status,401);
  assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{'oai-authenticated-user-email':'a@example.com',origin:'https://other.example','content-type':'application/json'},body:'{}'}),env)).status,403);
 }
});
test('file download authenticates owner, refuses cross-site access, and verifies bytes before attachment',async()=>{
 const env={G1_GATEWAY_SECRET:'fixture-only',SUPABASE_G1_URL:'https://fixture.example/function'},url='https://career.example/api/g2/download?exportId=11111111-1111-4111-8111-111111111111';
 const headers={'oai-authenticated-user-email':'a@example.com'};
 assert.equal((await worker.fetch(new Request(url),env)).status,401);
 assert.equal((await worker.fetch(new Request(url,{headers:{...headers,'sec-fetch-site':'cross-site'}}),env)).status,403);
 const oldFetch=globalThis.fetch,bytes=new TextEncoder().encode('fixture workbook'),hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 let corrupt=false;
 globalThis.fetch=async(_url,options)=>{
  const e=JSON.parse(Buffer.from(options.headers['x-career-envelope'],'base64url').toString());
  assert.equal(e.identity_email,'a@example.com');assert.equal(e.operation,'download_discovery_export');
  return Response.json({ok:true,base64:Buffer.from(bytes).toString('base64'),sha256:corrupt?'invalid':hash,fileName:'job-opportunities-v3.xlsx'});
 };
 try {
  const r=await worker.fetch(new Request(url,{headers}),env);
  assert.equal(r.status,200);assert.equal(r.headers.get('content-disposition'),'attachment; filename="job-opportunities-v3.xlsx"');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);
  corrupt=true;assert.equal((await worker.fetch(new Request(url,{headers}),env)).status,502);
 } finally{globalThis.fetch=oldFetch;}
});
