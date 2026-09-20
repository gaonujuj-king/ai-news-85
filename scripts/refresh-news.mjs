import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import briefing from '../lib/briefing.js';

const output = await briefing.latestBriefing();
const directory = new URL('../docs/data/', import.meta.url);
const target = new URL('latest.json', directory);
await mkdir(directory, { recursive: true });
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated ${output.items.length} items: ${fileURLToPath(target)}`);
