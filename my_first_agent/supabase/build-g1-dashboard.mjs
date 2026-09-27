import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const output=process.argv[2];
if(!output)throw new Error('Supply an explicit output file path for the browser editor bundle.');
const registry=await readFile(resolve(root,'../docs/references/job-search-sources.txt'),'utf8');
await writeFile(resolve(root,'functions/_shared/g2-registry.mjs'),`// Generated from docs/references/job-search-sources.txt.\nexport const G2_REGISTRY_TEXT = ${JSON.stringify(registry)};\n`);
const modules=['g1-domain.mjs','g2-registry.mjs','g2-domain.mjs','g2-workbook.mjs','g2-fixtures.mjs','g2-runtime.ts'];
const strip=s=>s.replace(/^import .* from ['"]\.\.?\/.*['"];\r?\n/gm,'').replace(/^export /gm,'');
const parts=[];
for(const name of modules)parts.push(strip(await readFile(resolve(root,'functions/_shared',name),'utf8')));
parts.push(strip(await readFile(resolve(root,'functions/career-g1/index.ts'),'utf8')));
const combined=parts.join('\n');
await writeFile(resolve(output),combined);
process.stdout.write(`Browser editor bundle written (${combined.length} characters).\n`);
