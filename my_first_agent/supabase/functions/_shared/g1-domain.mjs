export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 200_000;

const mediaTypes = new Map([
  ['pdf', 'application/pdf'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['txt', 'text/plain'],
]);

export function classifyFile(name, bytes) {
  const extension = String(name).split('.').pop()?.toLowerCase();
  const mediaType = mediaTypes.get(extension);
  if (!mediaType) return { ok: false, code: 'UNSUPPORTED_FILE', question: 'Please upload a PDF, DOCX, or TXT resume.' };
  if (!(bytes instanceof Uint8Array) || bytes.length === 0)
    return { ok: false, code: 'EMPTY_FILE', question: 'This resume file is empty. Can you upload a readable copy?' };
  if (bytes.length > MAX_FILE_BYTES)
    return { ok: false, code: 'FILE_TOO_LARGE', question: 'This file is over 5 MB. Can you upload a smaller PDF, DOCX, or TXT resume?' };
  if (extension === 'pdf' && new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
    return { ok: false, code: 'INVALID_PDF', question: 'This file does not appear to be a readable PDF. Can you upload another copy?' };
  if (extension === 'docx' && !(bytes[0] === 0x50 && bytes[1] === 0x4b))
    return { ok: false, code: 'INVALID_DOCX', question: 'This file does not appear to be a DOCX document. Can you upload another copy?' };
  if (extension === 'txt') {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return { ok: false, code: 'INVALID_TEXT', question: 'This text file cannot be read as UTF-8. Can you save it as UTF-8 or upload a PDF or DOCX?' }; }
  }
  return { ok: true, mediaType, extension };
}

export function sourcePassages(pages, kind) {
  if (!Array.isArray(pages) || !pages.length) return { ok: false, code: 'UNREADABLE_RESUME' };
  let characterCount = 0;
  const passages = [];
  for (const [pageIndex, page] of pages.entries()) {
    const lines = String(page).replace(/\r\n?/g, '\n').split('\n');
    for (const [lineIndex, line] of lines.entries()) {
      const text = line.trim().replace(/\s+/g, ' ');
      if (!text) continue;
      characterCount += text.length;
      if (characterCount > MAX_EXTRACTED_CHARS) return { ok: false, code: 'TEXT_TOO_LONG' };
      const reference = kind === 'pdf' ? `page ${pageIndex + 1}, line ${lineIndex + 1}`
        : kind === 'docx' ? `paragraph ${pageIndex + 1}` : `line ${lineIndex + 1}`;
      passages.push({ id: `${pageIndex + 1}:${lineIndex + 1}`, text, reference });
    }
  }
  if (!passages.length || characterCount < 20) return { ok: false, code: 'UNREADABLE_RESUME' };
  return { ok: true, passages, characterCount };
}

export function selectLiteralFacts(passages) {
  const sections = { education: [], experience: [], skills: [] };
  let section = null;
  for (const passage of passages) {
    const upper = passage.text.toUpperCase();
    if (/^EDUCATION\b/.test(upper)) { section = 'education'; continue; }
    if (/^(WORK|PROFESSIONAL|RELEVANT) EXPERIENCE\b/.test(upper)) { section = 'experience'; continue; }
    if (/^SKILLS(?:\s*&\s*HONORS)?\b/.test(upper)) { section = 'skills'; continue; }
    if (/^[A-Z][A-Z &/–-]{6,}$/.test(passage.text)) { section = null; continue; }
    if (section && sections[section].length < 8) sections[section].push(passage);
  }
  return sections;
}

export function validateConfirmation(passages, confirmedIds, correction) {
  const known = new Set(passages.map(p => p.id));
  if (!Array.isArray(confirmedIds))
    return { ok: false, code: 'INVALID_CONFIRMATION', question: 'Which extracted passages can you confirm? Select only items shown from your resume.' };
  const confirmed = new Set(confirmedIds);
  if (confirmed.size !== confirmedIds.length || [...confirmed].some(id => !known.has(id)))
    return { ok: false, code: 'INVALID_CONFIRMATION', question: 'Which extracted passages can you confirm? Select only items shown from your resume.' };
  if (!confirmed.size && !String(correction || '').trim())
    return { ok: false, code: 'CONFIRMATION_NEEDED', question: 'Please confirm at least one resume passage or tell us what needs correcting.' };
  return { ok: true, confirmedIds: [...confirmed], correction: String(correction || '').trim() };
}

export function validateScope(input) {
  const start = input?.startDate;
  const end = input?.endDate;
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(start) || !validDate(end) || end < start)
    return { ok: false, code: 'TIMEFRAME_NEEDED', question: 'What start-date range should the search use? Choose an earliest and latest date.' };
  const roles = Array.isArray(input?.roleTypes) ? [...new Set(input.roleTypes)] : [];
  if (!roles.length || roles.some(role => !['internship', 'entry-level'].includes(role)))
    return { ok: false, code: 'ROLE_TYPE_NEEDED', question: 'Should the search include internships, entry-level jobs, or both?' };
  const interests = Array.isArray(input?.roleInterests) ? input.roleInterests.map(s => String(s).trim()).filter(Boolean) : [];
  if (!interests.length)
    return { ok: false, code: 'ROLE_INTEREST_NEEDED', question: 'Which roles or career fields interest you?' };
  return { ok: true, startDate: start, endDate: end, roleTypes: roles, roleInterests: interests,
    locationPreference: String(input.locationPreference || '').trim() || null,
    optionalFacts: input.optionalFacts || {}, hardConstraints: input.hardConstraints || [] };
}

export function contextOutcome({ resume, scope, ledgerRead, handoffSaved }) {
  if (!resume?.confirmed) return { status: 'awaiting_student', code: 'RESUME_CONFIRMATION_NEEDED' };
  if (!scope?.confirmed) return { status: 'awaiting_student', code: 'SCOPE_CONFIRMATION_NEEDED' };
  if (ledgerRead?.kind === 'error') return { status: 'operationally_incomplete', code: handoffSaved ? 'LEDGER_READ_FAILED_HANDOFF_SAVED' : 'LEDGER_READ_AND_HANDOFF_FAILED' };
  if (ledgerRead?.kind !== 'ok') return { status: 'operationally_incomplete', code: 'LEDGER_STATE_UNKNOWN' };
  return { status: 'complete', code: ledgerRead.rows.length === 0 ? 'VALID_FIRST_RUN_EMPTY_LEDGER' : 'CONTEXT_READY', ledgerRows: ledgerRead.rows };
}
