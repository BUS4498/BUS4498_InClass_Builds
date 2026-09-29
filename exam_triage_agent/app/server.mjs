import http from 'node:http';
import { readFile, writeFile, rename, unlink, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError, createOrUpdate, logSession, selectTopic, setDone, validateStored, view } from './core.mjs';

const appDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(appDir, 'public');
const defaultDataDir = join(appDir, '..', 'data');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export function makeServer({ dataDir = defaultDataDir } = {}) {
  const file = join(dataDir, 'exam-triage.json');
  let queue = Promise.resolve();

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
      return view(null);
    }
    if (path !== '/api/context' && !current) throw new AppError('NO_CONTEXT', 'Save an exam first.');
    let next;
    if (path === '/api/context') next = createOrUpdate(current, input.draft);
    else if (path === '/api/select') next = selectTopic(current, input.topicId);
    else if (path === '/api/done') next = setDone(current, input.topicId, input.done);
    else if (path === '/api/log') next = logSession(current, input.entry);
    else throw new AppError('NOT_FOUND', 'This action is not available.', null, 404);
    return view(await persist(next));
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/state') return serialize(res, 200, view(await load()));
      if (req.method === 'POST' && ['/api/context', '/api/select', '/api/done', '/api/log', '/api/clear'].includes(url.pathname)) {
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
  const port = Number(process.env.PORT || 4173);
  makeServer().listen(port, '127.0.0.1', () => {
    process.stdout.write(`Exam Triage Agent: http://127.0.0.1:${port}\nPress Ctrl+C to stop.\n`);
  });
}
