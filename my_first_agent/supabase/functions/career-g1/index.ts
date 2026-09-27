import postgres from 'npm:postgres@3';
import { Buffer } from 'node:buffer';
import { createClient } from 'npm:@supabase/supabase-js@2';
import mammoth from 'npm:mammoth@1.12.3';
import { extractText } from 'npm:unpdf@1';
import { classifyFile, contextOutcome, selectLiteralFacts, sourcePassages, validateConfirmation, validateScope } from '../_shared/g1-domain.mjs';
import { createG4 } from '../_shared/g4-runtime.mjs';
import { createG4Model } from '../_shared/g4-model.mjs';
import { createG2 } from '../_shared/g2-runtime.ts';
import { createG3 } from '../_shared/g3-runtime.mjs';
import { resumeSummary, validateResumeReview, resetStudentSetup } from '../_shared/g1-review.mjs';
import { createOpportunityLibrary } from '../_shared/opportunity-library.mjs';

const SECRET = Deno.env.get('CAREER_G1_GATEWAY_SECRET');
const DB_URL = Deno.env.get('SUPABASE_DB_URL');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const sql = DB_URL ? postgres(DB_URL, { max: 1, prepare: false, idle_timeout: 10, connection: { statement_timeout: 5000 } }) : null;
const storage = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }).storage : null;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
function base64urlDecode(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function hex(bytes: Uint8Array) { return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function jsonColumn(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}
function exactEmail(value: unknown) {
  return typeof value === 'string' && value === value.trim().toLowerCase() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function authenticate(request: Request, body: Uint8Array) {
  if (!SECRET || !sql || !storage) return { ok: false, response: reply({ ok: false, code: 'NOT_CONFIGURED' }, 503) };
  const raw = request.headers.get('x-career-envelope');
  const signature = request.headers.get('x-career-signature');
  if (!raw || !signature || raw.length > 2000) return { ok: false, response: reply({ ok: false, code: 'SIGNED_GATEWAY_REQUIRED' }, 401) };
  let envelope;
  let encoded;
  let sig;
  try {
    encoded = base64urlDecode(raw);
    sig = base64urlDecode(signature);
    envelope = JSON.parse(decoder.decode(encoded));
  } catch { return { ok: false, response: reply({ ok: false, code: 'INVALID_ENVELOPE' }, 401) }; }
  const key = await crypto.subtle.importKey('raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC', key, sig, encoded)) return { ok: false, response: reply({ ok: false, code: 'INVALID_SIGNATURE' }, 401) };
  const now = Date.now();
  if (!exactEmail(envelope.identity_email) || !/^[0-9a-f-]{36}$/i.test(envelope.request_id || '') ||
      !/^[0-9a-f-]{36}$/i.test(envelope.nonce || '') ||
      !Number.isFinite(envelope.expires_at_ms) || envelope.expires_at_ms < now || envelope.expires_at_ms > now + 30_000 ||
      !['preview_resume','save_student_setup','reset_student_setup','retrieve_student_context','request_student_clarification',
        'start_discovery','step_discovery','list_discoveries','download_discovery_export','answer_validation_question','start_targeted_preparation','list_preparation','save_material_revision','record_student_review','download_material','list_opportunity_library','update_opportunity_library'].includes(envelope.operation))
    return { ok: false, response: reply({ ok: false, code: 'INVALID_ENVELOPE' }, 401) };
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', body)));
  if (digest !== envelope.body_sha256_hex) return { ok: false, response: reply({ ok: false, code: 'BODY_MISMATCH' }, 401) };
  const nonce = await sql`insert into career_prep.gateway_nonces (nonce,request_id,expires_at)
    values (${envelope.nonce},${envelope.request_id},to_timestamp(${envelope.expires_at_ms}/1000.0))
    on conflict do nothing returning nonce`;
  if (!nonce.length) return { ok: false, response: reply({ ok: false, code: 'REPLAY_DENIED' }, 409) };
  return { ok: true, envelope };
}

async function ownerId(email: string) {
  await sql!`insert into career_prep.owners (identity_email) values (${email}) on conflict do nothing`;
  const rows = await sql!`select id from career_prep.owners where identity_email = ${email}`;
  return rows[0].id as string;
}
async function handoff(owner: string, affected: string, question: string, source: string | null = null) {
  const existing = await sql!`select id,status,question,affected_input,source_reference,response_due_at from career_prep.context_handoffs
    where owner_id=${owner} and affected_input=${affected} and source_reference is not distinct from ${source}
      and status='awaiting_student' order by assigned_at desc limit 1`;
  if (existing.length) return existing[0];
  const rows = await sql!`insert into career_prep.context_handoffs (owner_id,affected_input,question,source_reference,response_due_at)
    values (${owner},${affected},${question},${source},
      case extract(isodow from now()) when 5 then now()+interval '3 days' when 6 then now()+interval '2 days' else now()+interval '1 day' end)
    returning id,status,question,affected_input,source_reference,response_due_at`;
  return rows[0];
}
async function parseResume(bytes: Uint8Array, extension: string) {
  if (extension === 'txt') return sourcePassages([new TextDecoder('utf-8', { fatal: true }).decode(bytes)], 'txt');
  if (extension === 'pdf') {
    const parsed = await extractText(bytes, { mergePages: false });
    return sourcePassages(Array.isArray(parsed.text) ? parsed.text : [parsed.text], 'pdf');
  }
  const parsed = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return sourcePassages(parsed.value.split(/\n\s*\n/), 'docx');
}
function decodeFile(base64: unknown) {
  if (typeof base64 !== 'string' || base64.length > 7_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('INVALID_FILE_DATA');
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function previewResume(owner: string, payload: any) {
  let bytes;
  try { bytes = decodeFile(payload?.base64); }
  catch { return reply({ ok: false, code: 'INVALID_FILE_DATA', question: 'Can you choose the resume file again?' }, 400); }
  const file = classifyFile(payload?.fileName, bytes);
  if (!file.ok) {
    const pending = await handoff(owner, 'resume_file', file.question, payload?.fileName || null);
    return reply({ ok: false, code: file.code, question: file.question, pending }, 422);
  }
  let extracted;
  try { extracted = await parseResume(bytes, file.extension); }
  catch { extracted = { ok: false, code: 'UNREADABLE_RESUME' }; }
  const resumeId = crypto.randomUUID();
  const objectPath = `${owner}/resumes/${resumeId}/original.${file.extension}`;
  const uploaded = await storage!.from('career-prep-private').upload(objectPath, bytes, { contentType: file.mediaType, upsert: false });
  if (uploaded.error) return reply({ ok: false, code: 'ORIGINAL_STORAGE_FAILED' }, 503);
  const sha = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  const passages = extracted.ok ? extracted.passages : [];
  const rawText = passages.map((passage: any) => passage.text).join('\n');
  let saved;
  try {
    saved = await sql!.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
      const next = await tx`select coalesce(max(version_number),0)+1 as version from career_prep.resume_versions where owner_id=${owner}`;
      return await tx`insert into career_prep.resume_versions
        (id,owner_id,version_number,original_path,original_name,media_type,byte_count,sha256_hex,extracted_text,extracted_passages,extraction_status)
        values (${resumeId},${owner},${next[0].version},${objectPath},${payload.fileName},${file.mediaType},${bytes.length},${sha},${rawText},${JSON.stringify(passages)}::jsonb,${extracted.ok ? 'readable' : 'unreadable'})
        returning id,version_number,extraction_status`;
    });
  } catch { return reply({ ok: false, code: 'RESUME_RECORD_FAILED', message: 'Original was stored but setup is incomplete. Contact support with this request ID.' }, 503); }
  if (!extracted.ok) {
    const question = extracted.code === 'TEXT_TOO_LONG' ? 'This resume has more than 200,000 extracted characters. Can you upload a shorter copy?' : 'We could not read text from this resume. Can you upload a readable PDF, DOCX, or TXT copy?';
    const pending = await handoff(owner, 'resume_text', question, `resume:${resumeId}`);
    return reply({ ok: false, code: extracted.code, resume: saved[0], question, pending }, 422);
  }
  return reply({ ok: true, resume: saved[0], facts: selectLiteralFacts(passages), passages, summary_draft: resumeSummary(passages),
    character_count: extracted.characterCount });
}

async function saveSetup(owner: string, payload: any) {
  const resume = (await sql!`select id,version_number,created_at,extraction_status,confirmation_status,extracted_passages
    from career_prep.resume_versions where owner_id=${owner} and id=${payload?.resumeId || '00000000-0000-0000-0000-000000000000'}`)[0];
  if (!resume) return reply({ ok: false, code: 'RESUME_NOT_FOUND' }, 404);
  if (resume.version_number !== payload.expectedResumeVersion) return reply({ ok: false, code: 'STALE_RESUME_VERSION' }, 409);
  if (resume.extraction_status !== 'readable') return reply({ ok: false, code: 'READABLE_RESUME_NEEDED' }, 422);
  const passages = jsonColumn(resume.extracted_passages);
  if (!Array.isArray(passages)) return reply({ ok: false, code: 'EXTRACTION_RECORD_INVALID' }, 503);
  const confirmation = validateResumeReview(payload.resumeReview, passages);
  if (!confirmation.ok) return reply({ ok: false, ...confirmation }, 422);
  if (!Number.isInteger(payload.expectedWorkspaceVersion)) return reply({ok:false,code:'WORKSPACE_VERSION_REQUIRED'},422);
  const scope = validateScope(payload.scope);
  if (!scope.ok) return reply({ ok: false, ...scope }, 422);
  let saved;
  try {
    saved = await sql!.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${owner}))`;
      const [workspace] = await tx`select setup_revision,setup_reset_at from career_prep.owners where id=${owner} for update`;
      if (!workspace || workspace.setup_revision !== payload.expectedWorkspaceVersion) throw new Error('STALE_WORKSPACE');
      if(workspace.setup_reset_at && new Date(resume.created_at)<=new Date(workspace.setup_reset_at))throw new Error('STALE_RESUME_VERSION');
      const [currentResume] = await tx`select id,version_number from career_prep.resume_versions
        where owner_id=${owner} order by version_number desc limit 1`;
      if (!currentResume || currentResume.id !== resume.id || currentResume.version_number !== payload.expectedResumeVersion)
        throw new Error('STALE_RESUME_VERSION');
      const latest = await tx`select coalesce(max(version_number),0) as version from career_prep.student_scopes where owner_id=${owner}`;
      if (latest[0].version !== payload.expectedScopeVersion) throw new Error('STALE_SCOPE_VERSION');
      await tx`update career_prep.resume_versions set confirmation_status='confirmed',
        confirmed_passage_ids=${JSON.stringify([])}::text::jsonb,
        student_correction=${confirmation.review.text},confirmed_at=now()
        where id=${resume.id} and owner_id=${owner}`;
      const rows = await tx`insert into career_prep.student_scopes
        (owner_id,resume_id,version_number,start_date,end_date,role_types,role_interests,location_preference,hard_constraints,optional_facts,student_confirmed_at,resume_review)
        values (${owner},${resume.id},${latest[0].version + 1},${scope.startDate},${scope.endDate},
          ${scope.roleTypes},${scope.roleInterests},${scope.locationPreference},${JSON.stringify(scope.hardConstraints)}::text::jsonb,
          ${JSON.stringify(scope.optionalFacts)}::text::jsonb,now(),${JSON.stringify(confirmation.review)}::text::jsonb) returning id,version_number`;
      await tx`update career_prep.owners set setup_revision=setup_revision+1,setup_reset_at=null where id=${owner}`;
      await tx`update career_prep.context_handoffs set status='response_received',response_kind='confirmed',
        response_text='Resolved through confirmed resume and search choices',responded_at=now()
        where owner_id=${owner} and status='awaiting_student'
          and affected_input in ('resume','resume_text','search_scope')`;
      return rows[0];
    });
  } catch (error) {
    const code = String(error).includes('STALE_WORKSPACE') ? 'STALE_WORKSPACE' : String(error).includes('STALE_RESUME_VERSION') ? 'STALE_RESUME_VERSION'
      : String(error).includes('STALE_SCOPE_VERSION') ? 'STALE_SCOPE_VERSION' : 'SETUP_SAVE_FAILED';
    return reply({ ok: false, code }, code === 'SETUP_SAVE_FAILED' ? 503 : 409);
  }
  const readBack = await sql!`select id,version_number,resume_review from career_prep.student_scopes where id=${saved.id} and owner_id=${owner}`;
  if (readBack.length !== 1 || readBack[0].version_number !== saved.version_number || jsonColumn(readBack[0].resume_review)?.text !== confirmation.review.text)
    return reply({ ok: false, code: 'SETUP_READBACK_FAILED' }, 503);
  return reply({ ok: true, scope: saved, resume: { id: resume.id, version_number: resume.version_number }, status: 'saved' });
}

async function retrieveContext(owner: string, payload: any) {
  const [workspace] = await sql!`select setup_revision,setup_reset_at from career_prep.owners where id=${owner}`;
  const [rawResume] = await sql!`select id,version_number,created_at,extracted_passages,confirmed_passage_ids,student_correction,confirmation_status,extraction_status
    from career_prep.resume_versions where owner_id=${owner} order by version_number desc limit 1`;
  const [rawScope] = await sql!`select id,version_number,resume_id,start_date::text as start_date,end_date::text as end_date,
    role_types,role_interests,location_preference,hard_constraints,optional_facts,resume_review
    from career_prep.student_scopes where owner_id=${owner} order by version_number desc limit 1`;
  const resume = rawResume ? { ...rawResume, extracted_passages: jsonColumn(rawResume.extracted_passages),
    confirmed_passage_ids: jsonColumn(rawResume.confirmed_passage_ids) } : null;
  const scope = rawScope ? { ...rawScope, hard_constraints: jsonColumn(rawScope.hard_constraints),
    optional_facts: jsonColumn(rawScope.optional_facts), resume_review: jsonColumn(rawScope.resume_review) } : null;
  const workspaceVersion=workspace?.setup_revision || 0;
  const summaryDraft=resume ? resumeSummary(resume.extracted_passages) : null;
  if(workspace?.setup_reset_at){
    const uploadedAfterReset=resume && new Date(resume.created_at)>new Date(workspace.setup_reset_at);
    return reply({ok:payload?.viewOnly===true,status:'needs_setup',code:'SETUP_RESET',workspace_version:workspaceVersion,setup_reset:true,scope_version:scope?.version_number||0,
      question:'Start your new setup by uploading a resume and confirming its summary.',
      pending_resume:uploadedAfterReset?{id:resume.id,version_number:resume.version_number,passages:resume.extracted_passages,summary_draft:summaryDraft}:null},payload?.viewOnly===true?200:422);
  }
  if (resume && !Array.isArray(resume.extracted_passages))
    return reply({ ok: false, status: 'operationally_incomplete', code: 'EXTRACTION_RECORD_INVALID' }, 503);
  const awaiting = await sql!`select id,affected_input,question,source_reference,status,response_due_at from career_prep.context_handoffs
    where owner_id=${owner} and status='awaiting_student' order by assigned_at desc limit 10`;
  const responses = await sql!`select id,affected_input,status,response_kind,response_text,responded_at
    from career_prep.context_handoffs where owner_id=${owner} and status='response_received' order by responded_at desc limit 20`;
  if (!resume || resume.confirmation_status !== 'confirmed' || !scope || scope.resume_id !== resume.id) {
    if (payload?.viewOnly === true) return reply({ ok: true, status: 'needs_setup', workspace_version:workspaceVersion, scope_version: scope?.version_number || 0,
      pending_resume: resume?.confirmation_status === 'pending' && resume.extraction_status === 'readable'
        ? { id: resume.id, version_number: resume.version_number, passages: resume.extracted_passages,summary_draft:summaryDraft } : null,
      pending_questions: awaiting, clarification_responses: responses });
    const question = !resume || resume.confirmation_status !== 'confirmed'
      ? 'Can you upload a readable resume and confirm the details we extract?'
      : !scope ? 'Can you confirm your role interests, role types, and timeframe?'
      : 'Can you review and confirm the latest resume and search choices?';
    const affected = !resume || resume.confirmation_status !== 'confirmed' ? 'resume' : 'search_scope';
    const recorded = responses.find(row => row.affected_input === affected);
    if (recorded) return reply({ ok: false, status: 'awaiting_student', code: 'RESPONSE_RECORDED_INPUT_STILL_NEEDED',
      question, recorded_response: { id: recorded.id, response_kind: recorded.response_kind } }, 422);
    const pending = await handoff(owner, affected, question);
    return reply({ ok: false, status: 'awaiting_student', question, pending, clarification_responses: responses }, 422);
  }
  let ledgerRead;
  let pending = null;
  try {
    const rows = await sql!`select id,created_at from career_prep.opportunity_ledger where owner_id=${owner} order by created_at desc`;
    ledgerRead = { kind: 'ok', rows };
  } catch {
    ledgerRead = { kind: 'error' };
    try { if (payload?.viewOnly !== true) pending = await handoff(owner, 'opportunity_ledger', 'We could not load your saved opportunity history. Please try again later or contact support.'); }
    catch { /* The failed handoff is reported explicitly below. */ }
  }
  const outcome = contextOutcome({ resume: { confirmed: true }, scope: { confirmed: true }, ledgerRead, handoffSaved: !!pending });
  if (outcome.status !== 'complete') return reply({ ok: false, ...outcome, pending }, 503);
  if(scope.resume_review?.text){resume.confirmed_passage_ids=[];resume.student_correction=null;resume.confirmed_summary=scope.resume_review.text;resume.summary_scope_version=scope.version_number;}
  return reply({ ok: true, status: 'complete', workspace_version:workspaceVersion, summary_review_required:!scope.resume_review?.text, summary_draft:summaryDraft, resume, scope, clarification_responses: responses,
    pending_questions: awaiting, opportunity_history: outcome.ledgerRows,
    first_run_empty: outcome.code === 'VALID_FIRST_RUN_EMPTY_LEDGER' });
}

async function respondToHandoff(owner: string, payload: any) {
  if (!['confirmed','corrected','unavailable'].includes(payload?.responseKind) || !String(payload?.responseText || '').trim())
    return reply({ ok: false, code: 'ANSWER_NEEDED', question: 'Please enter your answer, correction, or say that the information is unavailable.' }, 422);
  const rows = await sql!`update career_prep.context_handoffs set status='response_received',response_kind=${payload.responseKind},
    response_text=${String(payload.responseText).trim()},responded_at=now()
    where id=${payload?.handoffId || '00000000-0000-0000-0000-000000000000'} and owner_id=${owner} and status='awaiting_student'
    returning id,status,question,response_kind`;
  if (!rows.length) return reply({ ok: false, code: 'HANDOFF_NOT_FOUND_OR_STALE' }, 404);
  return reply({ ok: true, handoff: rows[0], next_step: 'Start a new context check; the answer has not been assumed as a resume fact.' });
}

const assessment = createG3({apiKey:Deno.env.get('OPENAI_API_KEY')});
const preparation = createG4({sql,storage,reply,jsonColumn,model:createG4Model({apiKey:Deno.env.get('OPENAI_API_KEY')})});
const g2 = createG2({ sql, storage, reply, retrieveContext, jsonColumn, assessment, preparation });
const library = createOpportunityLibrary({sql,reply,jsonColumn});
Deno.serve(async request => {
  if (request.method !== 'POST') return reply({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > 7_500_000) return reply({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);
  let auth;
  try { auth = await authenticate(request, body); }
  catch { return reply({ ok: false, code: 'GATEWAY_AUTH_UNAVAILABLE' }, 503); }
  if (!auth.ok) return auth.response;
  let payload;
  try { payload = JSON.parse(decoder.decode(body)); }
  catch { return reply({ ok: false, code: 'INVALID_JSON' }, 400); }
  try {
    const owner = await ownerId(auth.envelope.identity_email);
    if(['list_preparation','save_material_revision','record_student_review','download_material'].includes(auth.envelope.operation))return await preparation[auth.envelope.operation](owner,payload);
    if(Object.hasOwn(library,auth.envelope.operation))return await library[auth.envelope.operation](owner,payload);
    if (Object.hasOwn(g2, auth.envelope.operation)) return await g2[auth.envelope.operation](owner,payload);
    switch (auth.envelope.operation) {
      case 'preview_resume': return await previewResume(owner, payload);
      case 'save_student_setup': return await saveSetup(owner, payload);
      case 'reset_student_setup': return await resetStudentSetup({sql,reply},owner,payload);
      case 'retrieve_student_context': return await retrieveContext(owner, payload);
      case 'request_student_clarification': return await respondToHandoff(owner, payload);
    }
  } catch { return reply({ ok: false, code: 'OPERATION_FAILED', message: 'The operation could not be confirmed. Inspect saved state before trying another action.' }, 503); }
  return reply({ ok: false, code: 'UNKNOWN_OPERATION' }, 400);
});
