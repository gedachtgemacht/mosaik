// Kopiert mosaik.js in index.html zwischen die Marker, damit die Demoseite
// ohne Server (file://) und ohne Modul-Import laeuft.
// Aufruf: node einbetten.js
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'index.html');
const html = readFileSync(file, 'utf8');
const src = readFileSync(join(here, 'mosaik.js'), 'utf8').replace(/^export /gm, '');
const re = /\/\* MOSAIK START \*\/\n[\s\S]*?\/\* MOSAIK ENDE \*\//;
if (!re.test(html)) throw new Error('Marker in index.html fehlen');
writeFileSync(file, html.replace(re, () => '/* MOSAIK START */\n' + src + '/* MOSAIK ENDE */'));
console.log('mosaik.js in index.html eingebettet');
