import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Supply an explicit output file path for the browser editor bundle.');
const entry = await readFile(resolve(root, 'functions/career-g1/index.ts'), 'utf8');
const domain = await readFile(resolve(root, 'functions/_shared/g1-domain.mjs'), 'utf8');
const marker = "import { classifyFile, contextOutcome, selectLiteralFacts, sourcePassages, validateConfirmation, validateScope } from '../_shared/g1-domain.mjs';";
if (!entry.includes(marker)) throw new Error('Shared-module import changed; inspect before bundling.');
const combined = entry.replace(marker, domain);
await writeFile(resolve(output), combined, { flag: 'w' });
process.stdout.write(`Browser editor bundle written (${combined.length} characters).\n`);
