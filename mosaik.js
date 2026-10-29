// mosaik. Referenzimplementierung fuer das Format "mosaik 1".
// Reine Funktionen, keine Abhaengigkeiten, laeuft in Node und im Browser.
// Lizenz: AGPL-3.0

export const VERSION = 1;
export const MAX_SIZE = 64;
export const MAX_COLORS = 62;
export const MAX_COMMANDS = 256;
export const MAX_BYTES = 8192;

const MESSAGES = {
  E_HEADER: 'kopfzeile muss "mosaik 1 <breite> <hoehe>" sein',
  E_VERSION: 'unbekannte formatversion',
  E_SIZE: 'breite und hoehe muessen 1 bis 64 sein',
  E_COLOR: 'farbe muss sechs hexziffern haben, ohne #',
  E_DUP_KEY: 'schluessel ist schon vergeben',
  E_UNKNOWN_KEY: 'schluessel ist nicht in der palette',
  E_NUMBER: 'zahl muss 0 bis 255 sein, ohne vorzeichen und fuehrende nullen',
  E_ROWS: 'rows passt nicht zu breite oder hoehe',
  E_LIMIT: 'grenze ueberschritten',
  E_CHAR: 'nur druckbares ascii erlaubt',
  E_SYNTAX: 'zeile nicht verstanden',
  E_TRAILING: 'nach der leerzeile folgt noch inhalt',
};

function fail(code, line, detail) {
  const message = detail ? MESSAGES[code] + ': ' + detail : MESSAGES[code];
  return { ok: false, error: { code, line, message } };
}

const KEY_RE = /^[A-Za-z0-9]$/;
const HEX_RE = /^[0-9A-Fa-f]{6}$/;
const NUM_RE = /^(0|[1-9][0-9]{0,2})$/;

function num(s) {
  if (!NUM_RE.test(s)) return -1;
  const n = Number(s);
  return n <= 255 ? n : -1;
}

function isBlank(raw) {
  return /^ *\r?$/.test(raw);
}

// parse(text) liefert { ok: true, image } oder { ok: false, error: { code, line, message } }.
// Zeilen werden ab der Kopfzeile gezaehlt (Kopfzeile ist Zeile 1).
export function parse(text) {
  if (typeof text !== 'string') return fail('E_HEADER', 1, 'kein text');
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && isBlank(lines[i])) i++;
  if (i >= lines.length) return fail('E_HEADER', 1, 'leer');
  const start = i;

  let image = null;
  const keys = new Map();
  let commands = 0;
  let bytes = 0;
  let rowsSeen = false;
  let rowsLeft = 0;
  let rowsOp = null;

  for (; i < lines.length; i++) {
    const n = i - start + 1;
    let raw = lines[i];
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    for (let c = 0; c < raw.length; c++) {
      const code = raw.charCodeAt(c);
      if (code < 0x20 || code > 0x7e) {
        return fail('E_CHAR', n, 'zeichen ' + (c + 1));
      }
    }
    const line = raw.replace(/ +$/, '');
    if (line === '') break;
    bytes += raw.length + 1;
    if (bytes > MAX_BYTES) return fail('E_LIMIT', n, 'mehr als ' + MAX_BYTES + ' bytes');

    if (n === 1) {
      const f = line.split(/ +/);
      if (f[0] !== 'mosaik' || f.length < 2) return fail('E_HEADER', n);
      if (f[1] !== '1') {
        return /^[0-9]+$/.test(f[1]) ? fail('E_VERSION', n, f[1]) : fail('E_HEADER', n);
      }
      if (f.length !== 4) return fail('E_HEADER', n);
      const w = num(f[2]);
      const h = num(f[3]);
      if (w < 0 || h < 0) return fail('E_NUMBER', n);
      if (w < 1 || w > MAX_SIZE || h < 1 || h > MAX_SIZE) return fail('E_SIZE', n, w + ' x ' + h);
      image = { width: w, height: h, palette: [], ops: [] };
      continue;
    }

    if (line[0] === ';') continue;

    if (rowsLeft > 0) {
      if (line.length !== image.width) {
        return fail('E_ROWS', n, line.length + ' statt ' + image.width + ' zeichen');
      }
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch !== '.' && !keys.has(ch)) return fail('E_UNKNOWN_KEY', n, '"' + ch + '" an stelle ' + (c + 1));
      }
      rowsOp.lines.push(line);
      rowsLeft--;
      continue;
    }

    const f = line.split(/ +/);
    if (f[0] === '') return fail('E_SYNTAX', n, 'leerzeichen am zeilenanfang');
    const cmd = f[0];

    if (cmd === 'rect' || cmd === 'line' || cmd === 'rows') {
      commands++;
      if (commands > MAX_COMMANDS) return fail('E_LIMIT', n, 'mehr als ' + MAX_COMMANDS + ' befehle');
    }

    if (cmd === 'rect' || cmd === 'line') {
      if (f.length !== 6) return fail('E_SYNTAX', n, cmd + ' braucht vier zahlen und einen schluessel');
      const v = [];
      for (let k = 1; k <= 4; k++) {
        const x = num(f[k]);
        if (x < 0) return fail('E_NUMBER', n, f[k]);
        v.push(x);
      }
      if (!keys.has(f[5])) return fail('E_UNKNOWN_KEY', n, '"' + f[5] + '"');
      if (cmd === 'rect') image.ops.push({ op: 'rect', x: v[0], y: v[1], w: v[2], h: v[3], key: f[5] });
      else image.ops.push({ op: 'line', x0: v[0], y0: v[1], x1: v[2], y1: v[3], key: f[5] });
      continue;
    }

    if (cmd === 'rows') {
      if (f.length !== 1) return fail('E_SYNTAX', n, 'rows steht allein');
      if (rowsSeen) return fail('E_ROWS', n, 'rows darf nur einmal vorkommen');
      rowsSeen = true;
      rowsLeft = image.height;
      rowsOp = { op: 'rows', lines: [] };
      image.ops.push(rowsOp);
      continue;
    }

    if (f.length === 2 && cmd.length === 1) {
      if (!KEY_RE.test(cmd)) return fail('E_SYNTAX', n, '"' + cmd + '" ist kein schluessel');
      if (!HEX_RE.test(f[1])) return fail('E_COLOR', n, f[1]);
      if (keys.has(cmd)) return fail('E_DUP_KEY', n, '"' + cmd + '"');
      if (keys.size >= MAX_COLORS) return fail('E_LIMIT', n, 'mehr als ' + MAX_COLORS + ' farben');
      keys.set(cmd, image.palette.length);
      image.palette.push({ key: cmd, color: f[1].toLowerCase() });
      continue;
    }

    return fail('E_SYNTAX', n, '"' + cmd + '"');
  }

  const end = i - start + 1;
  if (rowsLeft > 0) return fail('E_ROWS', end, rowsLeft + ' zeilen fehlen');

  for (let j = i + 1; j < lines.length; j++) {
    if (!isBlank(lines[j])) return fail('E_TRAILING', j - start + 1);
  }
  return { ok: true, image };
}

// Bresenham genau nach SPEC.md, ruft plot(x, y) fuer jedes Pixel der Linie.
export function linePixels(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    plot(x, y);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// paint(img) liefert je Pixel den Palettenindex plus 1, 0 heisst transparent.
export function paint(img) {
  const { width: W, height: H } = img;
  const grid = new Uint8Array(W * H);
  const index = new Map();
  img.palette.forEach((p, k) => index.set(p.key, k + 1));
  const set = (x, y, v) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = v;
  };
  for (const op of img.ops) {
    if (op.op === 'rect') {
      const v = index.get(op.key);
      const xe = Math.min(W, op.x + op.w);
      const ye = Math.min(H, op.y + op.h);
      for (let y = op.y; y < ye; y++) for (let x = op.x; x < xe; x++) grid[y * W + x] = v;
    } else if (op.op === 'line') {
      const v = index.get(op.key);
      linePixels(op.x0, op.y0, op.x1, op.y1, (x, y) => set(x, y, v));
    } else if (op.op === 'rows') {
      op.lines.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '.') set(x, y, index.get(row[x]));
        }
      });
    }
  }
  return grid;
}

function rgb(hex) {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

// render(img) liefert RGBA-Pixel, Breite mal Hoehe mal 4.
export function render(img) {
  const grid = paint(img);
  const out = new Uint8ClampedArray(grid.length * 4);
  const colors = img.palette.map((p) => rgb(p.color));
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k];
    if (!v) continue;
    const c = colors[v - 1];
    out[k * 4] = c[0];
    out[k * 4 + 1] = c[1];
    out[k * 4 + 2] = c[2];
    out[k * 4 + 3] = 255;
  }
  return out;
}

// canonical(img) liefert die kanonische Textform.
export function canonical(img) {
  const out = ['mosaik 1 ' + img.width + ' ' + img.height];
  for (const p of img.palette) out.push(p.key + ' ' + p.color.toLowerCase());
  for (const op of img.ops) {
    if (op.op === 'rect') out.push(['rect', op.x, op.y, op.w, op.h, op.key].join(' '));
    else if (op.op === 'line') out.push(['line', op.x0, op.y0, op.x1, op.y1, op.key].join(' '));
    else if (op.op === 'rows') out.push('rows', ...op.lines);
  }
  return out.join('\n') + '\n';
}

// flattenImage(img) loest alle Formen in ein Raster auf, Palette bleibt gleich.
export function flattenImage(img) {
  const grid = paint(img);
  const lines = [];
  for (let y = 0; y < img.height; y++) {
    let row = '';
    for (let x = 0; x < img.width; x++) {
      const v = grid[y * img.width + x];
      row += v ? img.palette[v - 1].key : '.';
    }
    lines.push(row);
  }
  return {
    width: img.width,
    height: img.height,
    palette: img.palette.map((p) => ({ key: p.key, color: p.color })),
    ops: [{ op: 'rows', lines }],
  };
}

// flatten(img) liefert die kanonische Form nur mit rows.
export function flatten(img) {
  return canonical(flattenImage(img));
}

// toSVG(img, scale) liefert selbst erzeugtes SVG nur aus svg und rect.
export function toSVG(img, scale = 1) {
  const s = Math.max(1, Math.min(64, Math.floor(Number(scale)) || 1));
  const { width: W, height: H } = img;
  const grid = paint(img);
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W * s + '" height="' + H * s +
      '" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges">',
  ];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const v = grid[y * W + x];
      let e = x + 1;
      while (e < W && grid[y * W + e] === v) e++;
      if (v) {
        const color = img.palette[v - 1].color.toLowerCase();
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + (e - x) + '" height="1" fill="#' + color + '"/>');
      }
      x = e;
    }
  }
  parts.push('</svg>');
  return parts.join('\n') + '\n';
}

// extract(text) findet den ersten mosaik-Block in beliebigem Text, auch in Codezaeunen
// und in zitierten Mails ("> "). Liefert den Blocktext oder null.
export function extract(text) {
  if (typeof text !== 'string') return null;
  const lines = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^([ >]*)mosaik +[0-9]+( |$)/.exec(lines[i]);
    if (!m) continue;
    const prefix = m[1];
    const out = [lines[i].slice(prefix.length)];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      let body;
      if (l.startsWith(prefix)) body = l.slice(prefix.length);
      else break;
      if (/^ *$/.test(body) || /^(```|~~~)/.test(body)) break;
      out.push(body);
    }
    return out.map((l) => l.replace(/ +$/, '')).join('\n') + '\n';
  }
  return null;
}

// stats(img) fuer die Statuszeile.
export function stats(img) {
  const counts = { rect: 0, line: 0, rows: 0 };
  for (const op of img.ops) counts[op.op]++;
  return { width: img.width, height: img.height, colors: img.palette.length, ...counts };
}
