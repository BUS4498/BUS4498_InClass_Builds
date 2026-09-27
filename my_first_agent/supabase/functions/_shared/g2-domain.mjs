export const G2_LIMITS = Object.freeze({ requests: 8, leads: 40, reads: 24, elapsedMs: 480000, callMs: 15000 });
export const G2_SOURCES = [
  { name: 'Indeed', domains: ['indeed.com'], route: 'Public search index; listing is a lead only' },
  { name: 'Handshake', skip: 'Student or school login may be required; no authorized connector configured.' },
  { name: 'LinkedIn Jobs', skip: 'Automated LinkedIn access is not enabled; no scraping or login automation.' },
  { name: 'Simplify Jobs', domains: ['simplify.jobs'], route: 'Public search index; listing is a lead only' },
  { name: 'Google Jobs', skip: 'The Google Jobs interface is not a general job-search API.' },
  { name: 'USAJOBS', domains: ['usajobs.gov'], route: 'Public search index and exact official announcement' },
  { name: 'ZipRecruiter', domains: ['ziprecruiter.com'], route: 'Public search index; listing is a lead only' },
  { name: 'Employer career sites', domains: ['job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com'], route: 'Public index of employer ATS postings; structured posting required' },
];
const ATS_HOSTS = ['job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com'];
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
export const g2Normalize = v => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function g2Canonical(v) { return JSON.stringify(v, function(_key,value){ return value && typeof value==='object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])) : value; }); }
export function g2PublicUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|gh_src$)/i.test(key)) u.searchParams.delete(key);
    return u.href;
  } catch { return null; }
}
export function g2Authority(value, employerDomains = []) {
  const url = g2PublicUrl(value);
  if (!url) return null;
  const u = new URL(url);
  if (ATS_HOSTS.includes(u.hostname) && u.pathname.split('/').filter(Boolean).length >= 2) return 'employer ATS';
  if (['www.usajobs.gov','usajobs.gov'].includes(u.hostname) && /^\/job\/(?:view\/)?\d+\/?$/i.test(u.pathname)) return 'official USAJOBS';
  if (employerDomains.includes(u.hostname) && u.pathname !== '/') return 'employer career site';
  return null;
}
export function g2PostingUrl(value, category) {
  const url=g2PublicUrl(value);if(!url)return false;const u=new URL(url);
  if(category==='Indeed')return /\/(?:viewjob|rc\/clk|pagead\/clk)$/.test(u.pathname)&&!!u.searchParams.get('jk');
  if(category==='Simplify Jobs')return /^\/p\/[a-f0-9-]{36}\//i.test(u.pathname);
  if(category==='USAJOBS')return !!g2Authority(url);
  if(category==='ZipRecruiter')return /\/Job\//i.test(u.pathname)||u.searchParams.has('jid')||/\/jobs\/[^/]+\/[^/]+/i.test(u.pathname);
  if(category==='Employer career sites')return !!g2Authority(url);
  return false;
}
export function g2Plan(scope, registryText) {
  for (const source of G2_SOURCES) if (!registryText.includes(`${source.name} |`)) throw new Error('SOURCE_REGISTRY_MISMATCH');
  const interests = scope.role_interests;
  if (!Array.isArray(interests) || !interests.length || interests.length > 5 ||
      interests.some(s => typeof s !== 'string' || s.length > 80 || !/^[\p{L}\p{N} &+./-]+$/u.test(s) || /\d{5}|https?:|@/i.test(s)))
    throw new Error('PUBLIC_SEARCH_TERMS_NEEDED');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scope.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(scope.end_date) || scope.end_date < scope.start_date)
    throw new Error('CONFIRMED_TIMEFRAME_NEEDED');
  const types = scope.role_types;
  if (!Array.isArray(types) || !types.length || types.some(t => !['internship','entry-level'].includes(t))) throw new Error('ROLE_TYPE_NEEDED');
  const years = [...new Set([scope.start_date.slice(0,4), scope.end_date.slice(0,4)])].join(' OR ');
  const intent = `${interests.join(' OR ')} ${types.join(' OR ')} ${years} job posting`;
  return G2_SOURCES.map((source, order) => ({ ...source, order, intent, status: source.skip ? 'skipped' : 'planned',
    attempts: 0, leads: 0, reads: 0, verified: 0, reason: source.skip || null, queries: null }));
}
export function g2NewState({ id, scope, registryText, mode, now }) {
  return { id, scope, mode, stage: 'search', started_at: now, deadline_ms: Date.parse(now) + G2_LIMITS.elapsedMs,
    plan: g2Plan(scope, registryText), cursor: 0, read_cursor: 0, counters: { api_attempts: 0, hosted_reserved: 0, hosted_observed: 0, leads: 0, reads: 0, skipped: 0 },
    leads: [], incomplete: false, issues: [], inflight: null, stopping_reason: null, ledger_status: 'not_written', export_status: 'not_written' };
}
export function g2Reserve(state, kind, nowMs) {
  if (nowMs >= state.deadline_ms) throw new Error('SEARCH_DEADLINE');
  if (kind === 'search') {
    if (state.counters.api_attempts >= G2_LIMITS.requests || state.counters.hosted_reserved >= G2_LIMITS.requests) throw new Error('REQUEST_CAP');
    const item = state.plan[state.cursor];
    if (!item || item.skip) throw new Error('UNPLANNED_REQUEST');
    state.counters.api_attempts++; state.counters.hosted_reserved++; item.attempts++; item.status = 'attempted';
    state.cursor++;
    return item;
  }
  if (state.counters.reads >= G2_LIMITS.reads) throw new Error('READ_CAP');
  const lead = state.leads[state.read_cursor++];
  if (!lead) throw new Error('UNPLANNED_READ');
  state.counters.reads++; state.plan[lead.source_order].reads++;
  return lead;
}
export function g2SearchSources(response) {
  if (response.status !== 'completed') throw new Error('PROVIDER_INCOMPLETE');
  const calls = (response.output || []).filter(i => i.type?.endsWith('_call'));
  if (calls.length !== 1 || calls[0].type !== 'web_search_call' || calls[0].action?.type !== 'search' || calls[0].status !== 'completed')
    throw new Error('UNEXPECTED_SEARCH_ACTION');
  const a = calls[0].action;
  if (!Array.isArray(a.sources)) throw new Error('SEARCH_SOURCES_UNAVAILABLE');
  const queries = Array.isArray(a.queries) ? a.queries.filter(q => typeof q === 'string') : typeof a.query === 'string' ? [a.query] : null;
  return { sources: a.sources.filter(s => typeof s.url === 'string').map(s => ({ url: s.url, title: clean(s.title).slice(0,300) })), queries, observed: 1 };
}
export function g2AddLeads(state, item, results, now) {
  item.queries = results.queries; item.status = 'used'; item.checked_at = now;
  state.counters.hosted_observed += results.observed;
  const seen = new Set(state.leads.map(l => l.url));
  for (const source of results.sources) {
    if (state.leads.length >= G2_LIMITS.leads) { state.stopping_reason = 'lead cap'; break; }
    const url = g2PublicUrl(source.url);
    if (url && seen.has(url)) { item.duplicate_links = (item.duplicate_links || 0) + 1; continue; }
    const host = url ? new URL(url).hostname : '';
    const allowed = (state.mode==='synthetic' && host.endsWith('.example')) || item.domains.some(d => host === d || host.endsWith(`.${d}`));
    if(allowed && state.mode!=='synthetic' && !g2PostingUrl(url,item.name)){
      item.non_posting_references=(item.non_posting_references||0)+1;
      item.reference_urls=item.reference_urls||[];if(item.reference_urls.length<100)item.reference_urls.push(url);
      continue; // Search/category/help pages are source references, not job leads.
    }
    state.leads.push({ candidate_id: `${state.id}:${state.leads.length+1}`, order: state.leads.length, source_order: item.order,
      source: item.name, url: url || source.url.slice(0,1000), title: source.title, retrieved_at: now,
      access: allowed ? 'pending' : 'unverified', access_reason: allowed ? null : 'Search source URL was outside the planned domain filter.', posting: null });
    if (url) seen.add(url);
    state.counters.leads++; item.leads++;
  }
}
export function g2Text(html) {
  return clean(String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>Number(n)>0&&Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):' '));
}
export function g2ParsePosting(html, url, authority, now) {
  const jobs = [];
  const visit = v => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(visit); return; }
    if ([v['@type']].flat().includes('JobPosting')) jobs.push(v); if (v['@graph']) visit(v['@graph']); };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* malformed structured data is not evidence */ }
  }
  if (jobs.length !== 1) return { ok: false, reason: jobs.length ? 'Page contains multiple jobs; exact posting identity is ambiguous.' : 'No readable structured JobPosting on this page.' };
  const j = jobs[0], role = g2Text(j.title), employer = g2Text(j.hiringOrganization?.name);
  if (!role || !employer || !j.description) return { ok: false, reason: 'Posting lacks employer, title, or description evidence.' };
  const statedUrl = j.url ? g2PublicUrl(j.url) : null;
  if (j.url && (!statedUrl || statedUrl !== g2PublicUrl(url))) return { ok: false, reason: 'Structured posting URL does not match the checked page.' };
  const description = g2Text(j.description).slice(0,40000);
  const locations = [j.jobLocation].flat().filter(Boolean).map(l => typeof l === 'string' ? l : [l.address?.addressLocality,l.address?.addressRegion,l.address?.addressCountry].filter(Boolean).join(', '));
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0,10) : null;
  const closed = (date(j.validThrough) && date(j.validThrough) < now.slice(0,10)) || /this (?:job|position|posting) (?:is no longer available|has been filled)|no longer accepting applications/i.test(g2Text(html));
  const titleText = `${role} ${clean(j.employmentType)}`;
  const role_type = /intern(?:ship)?\b/i.test(titleText) ? 'internship' : /entry[ -]level|\bjunior\b|new grad|graduate (?:program|analyst|engineer)/i.test(titleText) ? 'entry-level' : null;
  const fields = [j.qualifications,j.skills,j.experienceRequirements,j.educationRequirements,j.responsibilities].filter(Boolean).map(g2Text);
  const pay = j.baseSalary ? clean(JSON.stringify(j.baseSalary)).slice(0,2000) : null;
  const jobId = clean(j.identifier?.value || (typeof j.identifier === 'string' ? j.identifier : '')) || null;
  return { ok: true, posting: { employer, role, role_type, job_id: jobId, url, authority, checked_at: now,
    location: locations.join('; ') || null, remote: j.jobLocationType === 'TELECOMMUTE' ? true : null,
    description, requirements: fields, start_date: date(j.jobStartDate || j.startDate), deadline: date(j.validThrough),
    posted_date: date(j.datePosted), work_hours: typeof j.workHours==='string'?g2Text(j.workHours):null, compensation: pay, availability: closed ? 'closed' : authority === 'official USAJOBS' && date(j.validThrough) ? 'open' : 'unknown',
    evidence: [{ id: 'posting:title', text: role }, { id: 'posting:employer', text: employer }, { id: 'posting:description', text: description },
      ...fields.map((text,i)=>({id:`posting:criterion:${i+1}`,text}))] } };
}
export function g2Material(posting) {
  const keys = ['employer','role','location','remote','start_date','deadline','compensation','work_hours','availability','requirements','description'];
  return JSON.stringify(keys.map(k=>[k,typeof posting[k]==='boolean'?posting[k]:Array.isArray(posting[k])?posting[k].map(g2Normalize):g2Normalize(posting[k])]));
}
export function g2Validate(lead, scope, history = []) {
  const base = { ...lead, fit_score: null, eligibility: 'Not assessed', readiness: 'Not assessed', next_step: 'Review the source note.' };
  const excluded = (code, reason) => ({ ...base, disposition: code, reason });
  if (lead.access === 'pending') return excluded('not_processed', lead.access_reason || 'Source verification was not reached before the run stopped.');
  if (lead.access !== 'readable' || !lead.posting) return excluded('excluded_unverified', lead.access_reason || 'No verified authoritative posting.');
  const p = lead.posting;
  if (p.availability === 'closed') return excluded('excluded_closed', 'The posting explicitly closed or its stated deadline passed.');
  if (p.authority === 'official USAJOBS' && p.availability !== 'open') return excluded('excluded_unverified', 'A currently open official federal announcement is required; open status was not established.');
  if (!p.role_type || !scope.role_types.includes(p.role_type)) return excluded('excluded_role_type', 'Selected role-type relevance is not established by this posting.');
  const words = g2Normalize(`${p.role} ${p.description}`);
  const relevant = scope.role_interests.some(interest => g2Normalize(interest).split(' ').filter(w=>w.length>2).every(w => words.includes(w) || (w==='analytics' && words.includes('analyst'))));
  if (!relevant) return excluded('excluded_role_interest', 'The supplied posting does not establish the chosen role-interest relevance.');
  const years = [Number(scope.start_date.slice(0,4)), Number(scope.end_date.slice(0,4))];
  if (p.start_date && (p.start_date < scope.start_date || p.start_date > scope.end_date)) return excluded('excluded_timeframe', 'Stated start date is outside the chosen range.');
  const timeText=`${p.role}. ${p.description}`;
  const statedYears = [...timeText.matchAll(/(?:internship|intern|start(?:s|ing)?|summer|fall|spring|winter|graduate|program)[^.!?]{0,70}\b(20\d{2})\b|\b(20\d{2})\b[^.!?]{0,70}(?:internship|intern|start|summer|fall|spring|winter|graduate|program)/gi)].map(m=>Number(m[1]||m[2]));
  if (!p.start_date && !statedYears.some(y=>y>=years[0]&&y<=years[1])) return excluded('excluded_timeframe_unknown', 'Posting lacks evidence connecting the opportunity to the selected timeframe.');
  if (Array.isArray(scope.hard_constraints) && scope.hard_constraints.length) return { ...base, disposition:'held_validation', reason:'A confirmed hard constraint needs an explicit comparison.', question:'Which stated posting fact resolves your hard constraint for this role?', next_step:'Answer the validation question; the posting will be checked again in a zero-search run.' };
  const identity = g2PublicUrl(p.url);
  const matches = history.filter(h=>h.posting && (g2PublicUrl(h.posting.url)===identity || (p.job_id && h.posting.job_id===p.job_id && g2Normalize(h.posting.employer)===g2Normalize(p.employer))));
  const possible = history.filter(h=>h.posting && !(h.posting.job_id&&p.job_id&&h.posting.job_id!==p.job_id) && g2Normalize(h.posting.employer)===g2Normalize(p.employer) && g2Normalize(h.posting.role)===g2Normalize(p.role) && g2Normalize(h.posting.location)===g2Normalize(p.location));
  if (!matches.length && possible.length) return { ...base, disposition:'held_validation', reason:'A similar saved posting has a different identity.', question:'Does this posting replace the similar saved opportunity, or is it a separate position? Provide the employer posting ID if known.', next_step:'Answer the duplicate-identity question; no fit assessment has been made.' };
  const previous = matches[0];
  if (previous && g2Material(previous.posting)===g2Material(p)) return { ...base, opportunity_id:previous.opportunity_id, disposition:'excluded_unchanged',reason:'Already logged with unchanged supported posting facts.',next_step:'Open the saved posting if you want to review it.' };
  return { ...base, opportunity_id: previous?.opportunity_id || null, disposition:previous?'verified_changed':'verified_new', reason:previous?'Supported posting fields changed.':'Authoritative posting and initial relevance checked.',
    unknowns:['Eligibility and resume fitness have not been assessed.', ...(!p.start_date?['Exact start date is unknown; the stated year supports initial relevance only.']:[]), ...(!p.requirements.length?['Structured qualification fields are absent; description evidence requires later assessment.']:[]), ...(!p.deadline?['Deadline not stated.']:[]), ...(p.availability==='unknown'?['Current open status is not explicitly stated.']:[])],
    next_step:'Review the authoritative posting. Evidence-backed fitness assessment becomes available in G3.' };
}
