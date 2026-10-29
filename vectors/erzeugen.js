// Quelle der Testvektoren. Alle Erwartungen sind von Hand gerechnet und stehen hier
// als Daten, nicht aus der Implementierung abgeleitet.
// Aufruf: node vectors/erzeugen.js
// Schreibt vectors/<name>.mosaik, vectors/<name>.json und testvektoren.json.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const ok = (canonical, flatten, extra = {}) => ({ ok: true, canonical, flatten, ...extra });
const err = (code, line) => ({ ok: false, error: { code, line } });
const rows = (head, pal, r) => head + '\n' + pal.join('\n') + '\nrows\n' + r.join('\n') + '\n';

const V = [];
const add = (name, beschreibung, input, expect) => V.push({ name, beschreibung, input, expect });

add('01-raster', 'Scope Vektor 1: reines Raster mit Transparenz', 'mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n',
  ok('mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n', 'mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n', {
    width: 3, height: 2,
    rgba: [255,0,0,255, 0,0,255,255, 0,0,0,0, 0,0,0,0, 0,0,255,255, 255,0,0,255],
  }));
add('02-linie-rechteck', 'Scope Vektor 2: Linie trifft (0,2) (1,1) (2,1) (3,0)',
  'mosaik 1 4 3\na 9b8afb\nb 0d0d10\nrect 0 0 4 3 b\nline 0 2 3 0 a\n',
  ok('mosaik 1 4 3\na 9b8afb\nb 0d0d10\nrect 0 0 4 3 b\nline 0 2 3 0 a\n',
    rows('mosaik 1 4 3', ['a 9b8afb', 'b 0d0d10'], ['bbba', 'baab', 'abbb']), { width: 4, height: 3 }));
add('03-kanonisch', 'Scope Vektor 3: CRLF, doppeltes Leerzeichen, Kommentar, Hex gross, ohne letzten Zeilenumbruch',
  'mosaik 1  3 2\r\n; logo\r\na FF0000\r\nb 0000Ff\r\nrows\r\nab.\r\n.ba',
  ok('mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n', 'mosaik 1 3 2\na ff0000\nb 0000ff\nrows\nab.\n.ba\n', { width: 3, height: 2 }));
add('04-fehler-unbekannter-schluessel', 'Scope Vektor 4: x ist nicht in der Palette',
  'mosaik 1 3 2\na ff0000\nrows\nax.\n...\n', err('E_UNKNOWN_KEY', 4));
add('05-linie-senkrecht', 'x0 gleich x1', 'mosaik 1 3 4\na ffffff\nline 1 0 1 3 a\n',
  ok('mosaik 1 3 4\na ffffff\nline 1 0 1 3 a\n', rows('mosaik 1 3 4', ['a ffffff'], ['.a.', '.a.', '.a.', '.a.'])));
add('06-linie-waagerecht', 'y0 gleich y1, von rechts nach links', 'mosaik 1 4 2\na ffffff\nline 3 1 0 1 a\n',
  ok('mosaik 1 4 2\na ffffff\nline 3 1 0 1 a\n', rows('mosaik 1 4 2', ['a ffffff'], ['....', 'aaaa'])));
add('07-linie-vorwaerts', 'flache Linie, Gegenstueck zu 08', 'mosaik 1 5 2\na ffffff\nline 0 0 4 1 a\n',
  ok('mosaik 1 5 2\na ffffff\nline 0 0 4 1 a\n', rows('mosaik 1 5 2', ['a ffffff'], ['aa...', '..aaa'])));
add('08-linie-rueckwaerts', 'gleiche Linie mit vertauschten Endpunkten, Pixel bei x=2 anders als in 07',
  'mosaik 1 5 2\na ffffff\nline 4 1 0 0 a\n',
  ok('mosaik 1 5 2\na ffffff\nline 4 1 0 0 a\n', rows('mosaik 1 5 2', ['a ffffff'], ['aaa..', '...aa'])));
add('09-linie-steil', 'steile Linie', 'mosaik 1 3 5\na ffffff\nline 0 0 2 4 a\n',
  ok('mosaik 1 3 5\na ffffff\nline 0 0 2 4 a\n', rows('mosaik 1 3 5', ['a ffffff'], ['a..', '.a.', '.a.', '..a', '..a'])));
add('10-linie-punkt', 'Anfang gleich Ende', 'mosaik 1 3 3\na ffffff\nline 1 1 1 1 a\n',
  ok('mosaik 1 3 3\na ffffff\nline 1 1 1 1 a\n', rows('mosaik 1 3 3', ['a ffffff'], ['...', '.a.', '...'])));
add('11-abschneiden', 'Formen ragen ueber den Rand, kein Fehler', 'mosaik 1 4 3\na ff0000\nrect 2 1 9 9 a\nline 0 0 200 0 a\n',
  ok('mosaik 1 4 3\na ff0000\nrect 2 1 9 9 a\nline 0 0 200 0 a\n', rows('mosaik 1 4 3', ['a ff0000'], ['aaaa', '..aa', '..aa'])));
add('12-reihenfolge', 'spaetere Befehle uebermalen fruehere, Punkt laesst stehen, Palette darf spaeter kommen',
  'mosaik 1 2 2\n; grund\na 00ff00\nrect 0 0 2 2 a\nb 000000\nrows\n.b\nb.\nc ffffff\nline 0 0 0 0 c\n',
  ok('mosaik 1 2 2\na 00ff00\nb 000000\nc ffffff\nrect 0 0 2 2 a\nrows\n.b\nb.\nline 0 0 0 0 c\n',
    rows('mosaik 1 2 2', ['a 00ff00', 'b 000000', 'c ffffff'], ['cb', 'ba']), {
      width: 2, height: 2,
      rgba: [255,255,255,255, 0,0,0,255, 0,0,0,255, 0,255,0,255],
    }));
add('13-nur-palette', 'ohne Befehle bleibt alles transparent', 'mosaik 1 2 1\na 123456\n',
  ok('mosaik 1 2 1\na 123456\n', rows('mosaik 1 2 1', ['a 123456'], ['..']), { width: 2, height: 1, rgba: [0,0,0,0, 0,0,0,0] }));
add('14-gross-64', '64 mal 64 ist erlaubt', 'mosaik 1 64 64\na 000000\nrect 0 0 64 64 a\n',
  ok('mosaik 1 64 64\na 000000\nrect 0 0 64 64 a\n', rows('mosaik 1 64 64', ['a 000000'], Array(64).fill('a'.repeat(64))), { width: 64, height: 64 }));
add('15-leerzeichen-am-ende', 'Leerzeichen am Zeilenende werden ignoriert, auch in rows', 'mosaik 1 2 1  \na ff0000 \nrows \na.   \n',
  ok('mosaik 1 2 1\na ff0000\nrows\na.\n', 'mosaik 1 2 1\na ff0000\nrows\na.\n'));
{
  const lines = ['mosaik 1 1 1', 'a ff0000'];
  for (let k = 0; k < 256; k++) lines.push('rect 0 0 1 1 a');
  add('16-genau-256-befehle', '256 Befehle sind erlaubt', lines.join('\n') + '\n',
    ok(lines.join('\n') + '\n', rows('mosaik 1 1 1', ['a ff0000'], ['a'])));
}
{
  // 15 + 9 + 9 + 5 + 64 mal 65 + 173 mal 23 + 15 = 8192 Bytes, mit LF am Ende, kanonisch
  const r64 = Array(64).fill('a'.repeat(64));
  const lines = ['mosaik 1 64 64', 'a 000000', 'b ffffff', 'rows', ...r64];
  for (let k = 0; k < 173; k++) lines.push('rect 100 100 100 100 b');
  lines.push('rect 0 0 1 1 b');
  const text = lines.join('\n') + '\n';
  const flat = ['b' + 'a'.repeat(63), ...r64.slice(1)];
  add('17-genau-8192-bytes', 'kanonische Form mit genau 8192 Bytes inklusive LF am Ende ist gueltig', text,
    ok(text, rows('mosaik 1 64 64', ['a 000000', 'b ffffff'], flat), { width: 64, height: 64 }));
}

add('20-fehler-kopf', 'falsches Kopfwort', 'bild 1 3 2\n', err('E_HEADER', 1));
add('21-fehler-leer', 'leerer Text', '', err('E_HEADER', 1));
add('22-fehler-version', 'unbekannte Version', 'mosaik 2 3 2\na ff0000\n', err('E_VERSION', 1));
add('22a-fehler-version-vor-feldanzahl', 'Version wird vor der Feldanzahl geprueft', 'mosaik 2\n', err('E_VERSION', 1));
add('22b-fehler-version-zu-viele-felder', 'Version wird vor der Feldanzahl geprueft', 'mosaik 2 3 3 x\n', err('E_VERSION', 1));
add('22c-fehler-kopf-feldanzahl', 'Version 1 mit zu wenigen Feldern', 'mosaik 1 3\n', err('E_HEADER', 1));
add('23-fehler-groesse-65', '65 ist zu breit', 'mosaik 1 65 1\n', err('E_SIZE', 1));
add('24-fehler-groesse-0', '0 ist zu klein', 'mosaik 1 4 0\n', err('E_SIZE', 1));
add('25-fehler-farbe', 'Farbe mit #', 'mosaik 1 1 1\na #ff0000\n', err('E_COLOR', 2));
add('26-fehler-doppelt', 'Schluessel doppelt', 'mosaik 1 1 1\na ff0000\nb 00ff00\na 0000ff\n', err('E_DUP_KEY', 4));
add('27-fehler-fuehrende-null', 'fuehrende Null', 'mosaik 1 2 2\na ff0000\nrect 01 0 1 1 a\n', err('E_NUMBER', 3));
add('28-fehler-zahl-256', 'Zahl ueber 255', 'mosaik 1 2 2\na ff0000\nline 0 0 256 0 a\n', err('E_NUMBER', 3));
add('29-fehler-rows-breite', 'Rasterzeile zu kurz', 'mosaik 1 3 2\na ff0000\nrows\naa\n...\n', err('E_ROWS', 4));
add('30-fehler-rows-fehlt', 'Rasterzeile fehlt, Fehler in der Zeile nach dem Blockende', 'mosaik 1 2 2\na ff0000\nrows\naa\n', err('E_ROWS', 5));
add('31-fehler-rows-doppelt', 'rows zweimal', 'mosaik 1 1 1\na ff0000\nrows\na\nrows\na\n', err('E_ROWS', 5));
add('32-fehler-zeichen', 'Umlaut im Kommentar', 'mosaik 1 1 1\n; rötlich\na ff0000\n', err('E_CHAR', 2));
add('33-fehler-syntax', 'unbekannter Befehl', 'mosaik 1 1 1\na ff0000\ncircle 0 0 1 a\n', err('E_SYNTAX', 3));
add('34-fehler-nach-leerzeile', 'Inhalt nach Leerzeile', 'mosaik 1 1 1\na ff0000\n\nrect 0 0 1 1 a\n', err('E_TRAILING', 4));
add('35-fehler-palette-zu-spaet', 'Schluessel vor seiner Definition benutzt', 'mosaik 1 2 2\nrect 0 0 1 1 a\na ff0000\n', err('E_UNKNOWN_KEY', 2));
{
  const lines = ['mosaik 1 1 1', 'a ff0000'];
  for (let k = 0; k < 257; k++) lines.push('rect 0 0 1 1 a');
  add('36-fehler-257-befehle', '256 Befehle gehen, der 257. in Zeile 259 nicht', lines.join('\n') + '\n', err('E_LIMIT', 259));
}
{
  const lines = ['mosaik 1 1 1'];
  for (let k = 0; k < 81; k++) lines.push(';' + 'x'.repeat(99));
  add('37-fehler-8192-bytes', '13 + 81 mal 101 = 8194 Bytes, Grenze in Zeile 82 ueberschritten', lines.join('\n') + '\n', err('E_LIMIT', 82));
}
add('38-fehler-tabulator', 'Tabulator ist kein druckbares ASCII', 'mosaik 1 1 1\na\tff0000\n', err('E_CHAR', 2));

add('40-extract-codezaun', 'Block in einem Codezaun mitten in Chattext',
  'Hier ist das Bild:\n\n```mosaik\nmosaik 1 2 1\na ff0000\nrows\na.\n```\n\nGefaellt es dir?\n',
  { extract: 'mosaik 1 2 1\na ff0000\nrows\na.\n' });
add('41-extract-zitat', 'Block in einer zitierten Mail',
  'Am Montag schrieb Max Muster:\n> Schau mal:\n> mosaik 1 1 2\n> a 00ff00\n> rows\n> a\n> .\n>\n> Gruss\n',
  { extract: 'mosaik 1 1 2\na 00ff00\nrows\na\n.\n' });
add('42-extract-eingerueckt', 'eingerueckter Block, CRLF',
  'Notiz\r\n    mosaik 1 1 1\r\n    a 0000ff\r\n    rect 0 0 1 1 a\r\nEnde\r\n',
  { extract: 'mosaik 1 1 1\na 0000ff\nrect 0 0 1 1 a\n' });
add('43-extract-nichts', 'kein Block im Text', 'Ein Mosaik aus 1000 Steinen.\n', { extract: null });

const all = [];
for (const v of V) {
  const expect = { beschreibung: v.beschreibung, ...v.expect };
  writeFileSync(join(dir, v.name + '.mosaik'), v.input);
  writeFileSync(join(dir, v.name + '.json'), JSON.stringify(expect, null, 2) + '\n');
  all.push({ name: v.name, input: v.input, ...expect });
}
writeFileSync(join(dir, '..', 'testvektoren.json'),
  JSON.stringify({ format: 'mosaik 1', vektoren: all }, null, 1) + '\n');
console.log(V.length + ' Vektoren geschrieben');
