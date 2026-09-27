import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyFile, sourcePassages, selectLiteralFacts, validateConfirmation, validateScope, contextOutcome } from '../supabase/functions/_shared/g1-domain.mjs';

const fixturePath = new URL('./fixtures/synthetic-resume.txt', import.meta.url);

test('synthetic text resume keeps exact source references and never fills absent facts', async () => {
  const bytes = new Uint8Array(await readFile(fixturePath));
  assert.equal(classifyFile('synthetic-resume.txt', bytes).ok, true);
  const extracted = sourcePassages([new TextDecoder().decode(bytes)], 'txt');
  assert.equal(extracted.ok, true);
  const facts = selectLiteralFacts(extracted.passages);
  assert.equal(facts.education.some(p => p.reference === 'line 7' && p.text.includes('B.S. Information Systems')), true);
  assert.equal(facts.experience.some(p => p.reference === 'line 13' && p.text.includes('Data Volunteer')), true);
  assert.equal(facts.skills.some(p => p.reference === 'line 51' && p.text.includes('Power BI')), true);
  assert.equal(extracted.passages.some(p => p.text.includes('work authorization')), false);
});

test('bad and unreadable files produce actionable clarification instead of empty resume', () => {
  assert.equal(classifyFile('wrong.pdf', new TextEncoder().encode('not a PDF')).code, 'INVALID_PDF');
  assert.equal(classifyFile('wrong.docx', new TextEncoder().encode('not a ZIP')).code, 'INVALID_DOCX');
  assert.equal(classifyFile('oversize.txt', new Uint8Array(5 * 1024 * 1024 + 1)).code, 'FILE_TOO_LARGE');
  assert.equal(sourcePassages(['  \n'], 'pdf').code, 'UNREADABLE_RESUME');
});

test('confirmation accepts literal source IDs and preserves a separate student correction', () => {
  const passages = [{ id: '1:7', text: 'B.S. Information Systems', reference: 'line 7' }];
  assert.equal(validateConfirmation(passages, null, '').code, 'INVALID_CONFIRMATION');
  assert.equal(validateConfirmation(passages, ['1:9'], '').code, 'INVALID_CONFIRMATION');
  assert.equal(validateConfirmation(passages, [], '').code, 'CONFIRMATION_NEEDED');
  assert.deepEqual(validateConfirmation(passages, ['1:7'], 'Graduation date updated by student'), {
    ok: true, confirmedIds: ['1:7'], correction: 'Graduation date updated by student'
  });
});

test('scope requires student-selected dates, role types, and interests while allowing optional unknowns', () => {
  assert.equal(validateScope({ startDate: '2027-12-01', endDate: '2027-06-01', roleTypes: ['internship'], roleInterests: ['analytics'] }).code, 'TIMEFRAME_NEEDED');
  assert.equal(validateScope({ startDate: '2027-02-30', endDate: '2027-12-01', roleTypes: ['internship'], roleInterests: ['analytics'] }).code, 'TIMEFRAME_NEEDED');
  assert.equal(validateScope({ startDate: '2027-06-01', endDate: '2027-12-01', roleTypes: [], roleInterests: ['analytics'] }).code, 'ROLE_TYPE_NEEDED');
  assert.equal(validateScope({ startDate: '2027-06-01', endDate: '2027-12-01', roleTypes: 'internship', roleInterests: ['analytics'] }).code, 'ROLE_TYPE_NEEDED');
  const result = validateScope({ startDate: '2027-06-01', endDate: '2027-12-01', roleTypes: ['internship', 'entry-level'], roleInterests: ['analytics'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.optionalFacts, {});
});

test('a valid empty first ledger is distinct from a failed read, even with H1 saved', () => {
  const ready = { resume: { confirmed: true }, scope: { confirmed: true } };
  assert.equal(contextOutcome({ ...ready, ledgerRead: { kind: 'ok', rows: [] } }).code, 'VALID_FIRST_RUN_EMPTY_LEDGER');
  assert.deepEqual(contextOutcome({ ...ready, ledgerRead: { kind: 'error' }, handoffSaved: true }), {
    status: 'operationally_incomplete', code: 'LEDGER_READ_FAILED_HANDOFF_SAVED'
  });
});
