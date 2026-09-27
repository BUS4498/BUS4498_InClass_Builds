import { cp, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
if (resolve(dist) !== resolve(root, 'dist') || !resolve(dist).startsWith(`${resolve(root)}${sep}`))
  throw new Error('Build output path escaped the Site source directory');
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await mkdir(join(dist, '.openai'), { recursive: true });
await cp(join(root, 'static'), join(dist, 'client'), { recursive: true });
await copyFile(join(root, 'worker', 'index.mjs'), join(dist, 'server', 'index.js'));
const hosting = join(root, '.openai', 'hosting.json');
const hostingExample = join(root, '.openai', 'hosting.example.json');
await copyFile(existsSync(hosting) ? hosting : hostingExample, join(dist, '.openai', 'hosting.json'));
await writeFile(join(dist, 'server', 'wrangler.json'), JSON.stringify({
  name: 'career-opportunity-prep-agent',
  compatibility_date: '2026-09-26',
  main: 'index.js',
  no_bundle: true,
  assets: { directory: '../client', binding: 'ASSETS' },
}, null, 2) + '\n');
process.stdout.write(`Built ${dist}\n`);
