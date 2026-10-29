// Tests fuer mosaik.js gegen die Testvektoren und die Eigenschaften aus dem Scope.
// Aufruf: node test-calc.js  (oder node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parse, render, canonical, flatten, flattenImage, toSVG, extract, linePixels, MAX_COMMANDS,
} from './mosaik.js';

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, 'vectors');
const names = readdirSync(vdir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

function mustParse(text) {
  const r = parse(text);
  assert.ok(r.ok, 'parse fehlgeschlagen: ' + JSON.stringify(r.error));
  return r.image;
}

test('es gibt Vektoren', () => {
  assert.ok(names.length >= 30);
});

for (const name of names) {
  test('vektor ' + name, () => {
    const input = readFileSync(join(vdir, name + '.mosaik'), 'utf8');
    const exp = JSON.parse(readFileSync(join(vdir, name + '.json'), 'utf8'));
    if ('extract' in exp) {
      assert.equal(extract(input), exp.extract);
      return;
    }
    const r = parse(input);
    if (!exp.ok) {
      assert.equal(r.ok, false, 'Fehler erwartet');
      assert.equal(r.error.code, exp.error.code);
      assert.equal(r.error.line, exp.error.line);
      return;
    }
    assert.ok(r.ok, JSON.stringify(r.error));
    const img = r.image;
    if (exp.width) assert.equal(img.width, exp.width);
    if (exp.height) assert.equal(img.height, exp.height);
    assert.equal(canonical(img), exp.canonical);
    assert.equal(flatten(img), exp.flatten);
    const px = render(img);
    assert.ok(px instanceof Uint8ClampedArray);
    assert.equal(px.length, img.width * img.height * 4);
    if (exp.rgba) assert.deepEqual(Array.from(px), exp.rgba);
  });
}

test('testvektoren.json passt zu vectors/', () => {
  const all = JSON.parse(readFileSync(join(here, 'testvektoren.json'), 'utf8'));
  assert.equal(all.format, 'mosaik 1');
  assert.deepEqual(all.vektoren.map((v) => v.name).sort(), names);
  for (const v of all.vektoren) {
    assert.equal(v.input, readFileSync(join(vdir, v.name + '.mosaik'), 'utf8'), v.name);
  }
});

test('Scope Vektor 1 RGBA wortwoertlich', () => {
  const img = mustParse('mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n');
  assert.deepEqual(Array.from(render(img)),
    [255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 255]);
});

test('Scope Vektor 2 Linie trifft genau vier Pixel', () => {
  const hit = [];
  linePixels(0, 2, 3, 0, (x, y) => hit.push([x, y]));
  assert.deepEqual(hit, [[0, 2], [1, 1], [2, 1], [3, 0]]);
});

test('Linie x0=x1 und y0=y1', () => {
  const v = [];
  linePixels(2, 5, 2, 1, (x, y) => v.push([x, y]));
  assert.deepEqual(v, [[2, 5], [2, 4], [2, 3], [2, 2], [2, 1]]);
  const h = [];
  linePixels(0, 3, 4, 3, (x, y) => h.push([x, y]));
  assert.deepEqual(h, [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]]);
});

test('vertauschte Endpunkte: dokumentierter Unterschied', () => {
  const a = [];
  const b = [];
  linePixels(0, 0, 4, 1, (x, y) => a.push(x + ',' + y));
  linePixels(4, 1, 0, 0, (x, y) => b.push(x + ',' + y));
  assert.deepEqual(a, ['0,0', '1,0', '2,1', '3,1', '4,1']);
  assert.deepEqual(b, ['4,1', '3,1', '2,0', '1,0', '0,0']);
});

// kleiner deterministischer Zufall fuer Eigenschaftstests
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomImage(r) {
  const W = 1 + Math.floor(r() * 64);
  const H = 1 + Math.floor(r() * 64);
  const nc = 1 + Math.floor(r() * 8);
  const lines = ['mosaik 1 ' + W + ' ' + H];
  const keys = [];
  for (let k = 0; k < nc; k++) {
    const key = KEYS[Math.floor(r() * KEYS.length)];
    if (keys.includes(key)) continue;
    keys.push(key);
    const hex = Math.floor(r() * 0xffffff).toString(16).padStart(6, '0');
    lines.push(key + ' ' + (r() < 0.5 ? hex : hex.toUpperCase()));
  }
  const pick = () => keys[Math.floor(r() * keys.length)];
  const n = () => Math.floor(r() * (r() < 0.9 ? 70 : 256));
  let rows = false;
  const cmds = Math.floor(r() * 12);
  for (let c = 0; c < cmds; c++) {
    const t = r();
    if (t < 0.4) lines.push(['rect', n(), n(), n(), n(), pick()].join(' '));
    else if (t < 0.85) lines.push(['line', n(), n(), n(), n(), pick()].join(' '));
    else if (!rows) {
      rows = true;
      lines.push('rows');
      for (let y = 0; y < H; y++) {
        let s = '';
        for (let x = 0; x < W; x++) s += r() < 0.5 ? '.' : pick();
        lines.push(s);
      }
    }
    if (r() < 0.1) lines.push('; kommentar ' + c);
  }
  return lines.join(r() < 0.3 ? '\r\n' : '\n') + (r() < 0.5 ? '\n' : '');
}

test('Eigenschaft: canonical ist idempotent, flatten aendert keine Pixel', () => {
  const r = rng(20261029);
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const text = randomImage(r);
    const res = parse(text);
    if (!res.ok) {
      assert.equal(res.error.code, 'E_LIMIT', text);
      continue;
    }
    const img = res.image;
    const c = canonical(img);
    assert.equal(canonical(mustParse(c)), c);
    const f = flatten(img);
    assert.deepEqual(render(mustParse(f)), render(img));
    assert.equal(flatten(mustParse(f)), f);
    assert.deepEqual(flattenImage(img).ops.length, 1);
    checked++;
  }
  assert.ok(checked > 250);
});

test('Grenzen: 64 geht, 65 nicht, 257 Befehle nicht, Nicht-ASCII nicht', () => {
  assert.ok(parse('mosaik 1 64 64\n').ok);
  assert.equal(parse('mosaik 1 64 65\n').error.code, 'E_SIZE');
  assert.equal(parse('mosaik 1 65 64\n').error.code, 'E_SIZE');
  const many = ['mosaik 1 1 1', 'a 000000'];
  for (let k = 0; k <= MAX_COMMANDS; k++) many.push('line 0 0 0 0 a');
  const r = parse(many.join('\n'));
  assert.equal(r.error.code, 'E_LIMIT');
  assert.equal(r.error.line, 2 + MAX_COMMANDS + 1);
  const g = readFileSync(join(vdir, '17-genau-8192-bytes.mosaik'), 'utf8');
  assert.equal(g.length, 8192);
  assert.ok(parse(g).ok);
  assert.ok(parse(g + '\n  \n').ok);
  const zuViel = parse(g.replace('rect 0 0 1 1 b', 'rect 0 0 10 1 b'));
  assert.equal(zuViel.error.code, 'E_LIMIT');
  assert.equal(zuViel.error.line, 1 + 2 + 1 + 64 + 174);
  assert.equal(parse('mosaik 1 1 1\na ff0000\nrows\nä\n').error.code, 'E_CHAR');
  assert.equal(parse('mosaik 1 1 1\na ff0000\nrows\nä\n').error.line, 4);
});

test('weitere Fehlerfaelle mit Zeile', () => {
  const cases = [
    ['mosaik 1 3\n', 'E_HEADER', 1],
    ['mosaik x 3 2\n', 'E_HEADER', 1],
    ['mosaik 10 3 2\n', 'E_VERSION', 1],
    ['mosaik 1 03 2\n', 'E_NUMBER', 1],
    ['\n\n  \nmosaik 1 1 1\na fff\n', 'E_COLOR', 2],
    ['mosaik 1 1 1\n. ff0000\n', 'E_SYNTAX', 2],
    ['mosaik 1 1 1\n a ff0000\n', 'E_SYNTAX', 2],
    ['mosaik 1 1 1\na ff0000\nrect 0 0 1 a\n', 'E_SYNTAX', 3],
    ['mosaik 1 1 1\na ff0000\nrect 0 0 1 1 b\n', 'E_UNKNOWN_KEY', 3],
    ['mosaik 1 1 1\na ff0000\nrows x\n', 'E_SYNTAX', 3],
    ['mosaik 1 2 1\na ff0000\nrows\na. b\n', 'E_ROWS', 4],
    ['mosaik 1 1 1\nrect 0 0 1 1 .\n', 'E_UNKNOWN_KEY', 2],
    ['mosaik 1 1 1\na ff0000\rb 00ff00\n', 'E_CHAR', 2],
  ];
  for (const [text, code, line] of cases) {
    const r = parse(text);
    assert.equal(r.ok, false, text);
    assert.equal(r.error.code, code, text);
    assert.equal(r.error.line, line, text);
    assert.equal(typeof r.error.message, 'string');
  }
});

test('Kommentare zwischen Rasterzeilen sind erlaubt', () => {
  const img = mustParse('mosaik 1 1 2\na ff0000\nrows\na\n; mitte\n.\n');
  assert.equal(canonical(img), 'mosaik 1 1 2\na ff0000\nrows\na\n.\n');
});

test('toSVG enthaelt nur svg und rect, keine Skripte, keine Verweise', () => {
  const img = mustParse('mosaik 1 4 3\na 9b8afb\nb 0d0d10\nrect 0 0 4 3 b\nline 0 2 3 0 a\n');
  const svg = toSVG(img, 8);
  const tags = [...svg.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tags)].sort(), ['rect', 'svg']);
  assert.ok(!/href|script|on[a-z]+=|url\(|<!|<\?|style/i.test(svg));
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 4 3"'));
  // Zeile 1: baab ergibt drei Laeufe
  assert.ok(svg.includes('<rect x="0" y="1" width="1" height="1" fill="#0d0d10"/>'));
  assert.ok(svg.includes('<rect x="1" y="1" width="2" height="1" fill="#9b8afb"/>'));
  assert.equal((svg.match(/<rect /g) || []).length, 7);
  // transparente Pixel erzeugen kein rect
  assert.equal((toSVG(mustParse('mosaik 1 3 1\n'), 1).match(/<rect /g) || []).length, 0);
});

test('extract findet den ersten Block und liefert parsbaren Text', () => {
  const chat = 'Kannst du ein Herz malen?\n\nKlar:\n\n```\nmosaik 1 2 2\na f2777a\nrows\naa\n.a\n```\nund noch eins\nmosaik 1 1 1\n';
  const block = extract(chat);
  assert.equal(block, 'mosaik 1 2 2\na f2777a\nrows\naa\n.a\n');
  assert.ok(parse(block).ok);
  assert.equal(extract('mosaik 1 1 1 \na ff0000\n'), 'mosaik 1 1 1\na ff0000\n');
  assert.equal(extract(''), null);
});

test('index.html enthaelt mosaik.js unveraendert und gueltige Beispiele', () => {
  const html = readFileSync(join(here, 'index.html'), 'utf8');
  const src = readFileSync(join(here, 'mosaik.js'), 'utf8');
  const m = /\/\* MOSAIK START \*\/\n([\s\S]*?)\/\* MOSAIK ENDE \*\//.exec(html);
  assert.ok(m, 'Marker fehlen');
  assert.equal(m[1], src.replace(/^export /gm, ''), 'index.html neu einbetten: node einbetten.js');
  const b = /<script type="application\/json" id="beispiele">([\s\S]*?)<\/script>/.exec(html);
  const beispiele = JSON.parse(b[1]);
  assert.ok(beispiele.length >= 3 && beispiele.length <= 4);
  for (const e of beispiele) {
    const r = parse(e.text);
    assert.ok(r.ok, e.name + ': ' + JSON.stringify(r.error));
    assert.equal(canonical(r.image), e.text, e.name + ' ist nicht kanonisch');
  }
});
