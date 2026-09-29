import http from 'node:http';
import { readFile, writeFile, rename, unlink, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { AppError, adoptSuggestion, createOrUpdate, daysRemaining, localDate, logSession, recordSuggestion, selectTopic, setDone, validateStored, view } from './core.mjs';
import { compactContext, jevProvider, suggestWithJev } from './provider-jev.mjs';

const appDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(appDir, 'public');
const defaultDataDir = join(appDir, '..', 'data');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export function makeServer({ dataDir = defaultDataDir, providers = [jevProvider], suggestMethod = suggestWithJev } = {}) {
  const file = join(dataDir, 'exam-triage.json');
  let queue = Promise.resolve();
  const inFlightComparisons = new Map();
  const publicView = (snapshot) => ({ ...view(snapshot), providers: providers.map(p => ({ id: p.id, name: p.name, model: p.model, configured: p.configured })) });

  async function load() {
    try {
      return validateStored(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof AppError) throw error;
      throw new AppError('STORAGE_READ_FAILED', 'Could not read saved study data. No changes were made.', null, 500);
    }
  }

  async function persist(snapshot) {
    const temp = join(dataDir, `.${randomUUID()}.tmp`);
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(temp, JSON.stringify(snapshot, null, 2), { flag: 'wx', mode: 0o600 });
      await rename(temp, file);
      const readBack = await load();
      if (JSON.stringify(readBack) !== JSON.stringify(snapshot)) throw new Error('Read-back mismatch');
      return readBack;
    } catch {
      await unlink(temp).catch(() => {});
      throw new AppError('STORAGE_WRITE_FAILED', 'Save could not be verified. Reload to check the last saved version before continuing.', null, 500);
    }
  }

  async function clear() {
    try {
      await unlink(file);
      try {
        await stat(file);
        throw new Error('File still exists');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      throw new AppError('CLEAR_FAILED', 'Could not verify that app data was cleared. Reload to inspect the saved state.', null, 500);
    }
  }

  function serialize(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body), 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff' });
    res.end(body);
  }

  async function bodyOf(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 200_000) throw new AppError('TOO_LARGE', 'Request is too large.', null, 413);
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new AppError('INVALID_JSON', 'Could not read the submitted form.', null, 400); }
  }

  async function mutate(path, input) {
    const current = await load();
    if (!Number.isInteger(input?.expectedRevision) || input.expectedRevision !== (current?.revision || 0)) {
      throw new AppError('STALE_VERSION', 'This plan changed in another tab. Reload before saving your edits.', null, 409);
    }
    if (path === '/api/clear') {
      if (input.confirm !== 'CLEAR MY EXAM DATA') throw new AppError('CONFIRM_REQUIRED', 'Type CLEAR MY EXAM DATA to confirm.', 'confirmation');
      await clear();
      return publicView(null);
    }
    if (path !== '/api/context' && !current) throw new AppError('NO_CONTEXT', 'Save an exam first.');
    let next;
    if (path === '/api/context') next = createOrUpdate(current, input.draft);
    else if (path === '/api/select') next = selectTopic(current, input.topicId);
    else if (path === '/api/done') next = setDone(current, input.topicId, input.done);
    else if (path === '/api/log') next = logSession(current, input.entry);
    else if (path === '/api/adopt') next = adoptSuggestion(current, input);
    else throw new AppError('NOT_FOUND', 'This action is not available.', null, 404);
    return publicView(await persist(next));
  }

  async function compare(input) {
    const current = await load();
    if (!current?.sprint) throw new AppError('NO_SPRINT', 'Save or reopen a topic before comparing methods.');
    if (!Number.isInteger(input?.expectedRevision) || input.expectedRevision !== current.revision) {
      throw new AppError('STALE_VERSION', 'This plan changed in another tab. Reload before comparing methods.', null, 409);
    }
    const provider = providers.find(p => p.id === input.provider);
    if (!provider) throw new AppError('INVALID_PROVIDER', 'Choose a listed provider.', 'provider');
    const cached = (current.suggestions || []).find(s => s.provider === provider.id && s.status === 'valid' &&
      s.contextVersion === current.contextVersion && s.topicId === current.sprint.topicId);
    if (cached) return publicView(current);
    const requestKey = `${current.revision}:${current.contextVersion}:${current.sprint.topicId}:${provider.id}`;
    if (inFlightComparisons.has(requestKey)) return inFlightComparisons.get(requestKey);
    const pending = performComparison(current, provider);
    inFlightComparisons.set(requestKey, pending);
    try { return await pending; }
    finally { inFlightComparisons.delete(requestKey); }
  }

  async function performComparison(current, provider) {
    const compact = compactContext(current, daysRemaining(current.exam.date, localDate()));
    const result = await suggestMethod(compact, { provider });
    const task = queue.then(async () => {
      const latest = await load();
      if (!latest || latest.revision !== current.revision || latest.contextVersion !== current.contextVersion ||
          latest.sprint?.topicId !== current.sprint.topicId) {
        throw new AppError('STALE_VERSION', 'The plan changed while the provider was responding. Reload; no model result was saved.', null, 409);
      }
      const next = recordSuggestion(latest, { ...result, provider: provider.id, model: result.model || provider.model });
      return publicView(await persist(next));
    });
    queue = task.catch(() => {});
    return task;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        const localOrigin = `http://127.0.0.1:${server.address()?.port}`;
        if (origin && origin !== localOrigin) throw new AppError('FOREIGN_ORIGIN', 'Open this app from its local address before submitting an action.', null, 403);
        if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          throw new AppError('JSON_REQUIRED', 'This action requires the app form.', null, 415);
        }
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return serialize(res, 200, publicView(await load()));
      if (req.method === 'POST' && url.pathname === '/api/compare') return serialize(res, 200, await compare(await bodyOf(req)));
      if (req.method === 'POST' && ['/api/context', '/api/select', '/api/done', '/api/log', '/api/clear', '/api/adopt'].includes(url.pathname)) {
        const input = await bodyOf(req);
        const task = queue.then(() => mutate(url.pathname, input));
        queue = task.catch(() => {});
        return serialize(res, 200, await task);
      }
      if (req.method === 'GET' && staticFiles.has(url.pathname)) {
        const [name, type] = staticFiles.get(url.pathname);
        const content = await readFile(join(publicDir, name));
        res.writeHead(200, { 'content-type': type, 'content-length': content.length,
          'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
        return res.end(content);
      }
      throw new AppError('NOT_FOUND', 'Page not found.', null, 404);
    } catch (error) {
      const safe = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 'The app encountered an error. Reload and try again.', null, 500);
      serialize(res, safe.status, { error: { code: safe.code, message: safe.message, field: safe.field } });
    }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const envFile = join(appDir, '..', '.env');
  if (existsSync(envFile)) loadEnvFile(envFile);
  const port = Number(process.env.PORT || 4173);
  makeServer().listen(port, '127.0.0.1', () => {
    process.stdout.write(`Exam Triage Agent: http://127.0.0.1:${port}\nPress Ctrl+C to stop.\n`);
  });
}
