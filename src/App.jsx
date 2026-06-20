import React, { useState, useEffect, useMemo, useRef } from 'react';

/* ---------- Konstanten ---------- */
const TYPEN = ['Tablet', 'Notebook', 'Desktop-PC', 'Dokumentenkamera', 'Beamer/Projektor', 'Interaktive Tafel', 'Drucker', 'Zubehör', 'Sonstiges'];

const STATUS = {
  verfuegbar:   { label: 'verfügbar',    cls: 'verf' },
  verliehen:    { label: 'verliehen',    cls: 'verl' },
  reparatur:    { label: 'in Reparatur', cls: 'rep'  },
  ausgemustert: { label: 'ausgemustert', cls: 'aus'  },
};

const LEER = { id: null, inventarnummer: '', typ: 'Tablet', modell: '', hersteller: '', seriennummer: '', standort: '', status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: false, anschaffung: '', notiz: '' };

const DEFAULT_PRESETS = ['Klasse 7a', 'Klasse 7b', 'Kollegium', 'Vertretung', 'Sekretariat'];

const BEISPIELE = [
  { inventarnummer: 'IT-2023-0118', typ: 'Tablet', modell: 'iPad 9. Gen', hersteller: 'Apple', seriennummer: 'DMPX2K9Q1L', standort: 'Raum 204', status: 'verliehen', ausleiheAn: 'Klasse 7b', ausleiheVon: '2026-05-28', rueckgabe: '2026-06-26', digitalpakt: true, anschaffung: '2023', notiz: 'Tablet-Wagen 2, Fach 14' },
  { inventarnummer: 'IT-2023-0119', typ: 'Tablet', modell: 'iPad 9. Gen', hersteller: 'Apple', seriennummer: 'DMPX2K9Q2M', standort: 'Raum 204', status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: true, anschaffung: '2023', notiz: '' },
  { inventarnummer: 'IT-2024-0051', typ: 'Notebook', modell: 'ThinkPad L14 Gen 4', hersteller: 'Lenovo', seriennummer: 'PF3X8K2Q', standort: 'Lehrerzimmer', status: 'verliehen', ausleiheAn: 'Hr. Wagner', ausleiheVon: '2026-04-12', rueckgabe: '2026-06-12', digitalpakt: false, anschaffung: '2024', notiz: 'Dienstgerät Kollegium' },
  { inventarnummer: 'IT-2024-0052', typ: 'Notebook', modell: 'ThinkPad L14 Gen 4', hersteller: 'Lenovo', seriennummer: 'PF3X8K3R', standort: 'IT-Lager', status: 'reparatur', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: false, anschaffung: '2024', notiz: 'Display defekt – RMA offen' },
  { inventarnummer: 'IT-2022-0007', typ: 'Beamer/Projektor', modell: 'EB-685Wi', hersteller: 'Epson', seriennummer: 'X4ZK00231', standort: 'Aula', status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: false, anschaffung: '2022', notiz: 'Deckenmontage' },
  { inventarnummer: 'IT-2021-0033', typ: 'Desktop-PC', modell: 'OptiPlex 3080', hersteller: 'Dell', seriennummer: '7QJ4LM2', standort: 'Raum 011 (Informatik)', status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: false, anschaffung: '2021', notiz: '' },
  { inventarnummer: 'IT-2019-0002', typ: 'Desktop-PC', modell: 'OptiPlex 3070', hersteller: 'Dell', seriennummer: '7QJ1AA0', standort: 'IT-Lager', status: 'ausgemustert', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: false, anschaffung: '2019', notiz: 'EOL – zur Entsorgung' },
  { inventarnummer: 'IT-2024-0090', typ: 'Dokumentenkamera', modell: 'L-12iD', hersteller: 'ELMO', seriennummer: 'EL12ID4471', standort: 'Raum 118', status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '', digitalpakt: true, anschaffung: '2024', notiz: '' },
];

/* ---------- Helfer ---------- */
const uid = () => 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const heute = () => new Date().toISOString().slice(0, 10);
const inTagen = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDE = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const istUeberfaellig = (g) => g.status === 'verliehen' && g.rueckgabe && g.rueckgabe < heute();

// Tolerantes CSV-Parsen (Anführungszeichen, Trennzeichen, CRLF/LF)
function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', i = 0, inQ = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- Code 128 Barcode (ohne externe Bibliothek) ---------- */
const C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];

function code128BWidths(input) {
  const data = String(input || '');
  let sum = 104; const codes = [104];
  for (let i = 0; i < data.length; i++) {
    let v = data.charCodeAt(i) - 32;
    if (v < 0 || v > 94) v = '?'.charCodeAt(0) - 32;
    codes.push(v); sum += v * (i + 1);
  }
  codes.push(sum % 103);
  codes.push(106);
  return codes.map((c) => C128[c]).join('');
}

function Barcode({ value, height = 30 }) {
  const widths = code128BWidths(value);
  const quiet = 10;
  let x = quiet, bar = true;
  const rects = [];
  for (let i = 0; i < widths.length; i++) {
    const w = parseInt(widths[i], 10);
    if (bar) rects.push(<rect key={i} x={x} y={0} width={w} height={height} fill="#000" />);
    x += w; bar = !bar;
  }
  const total = x + quiet;
  return (
    <svg viewBox={`0 0 ${total} ${height}`} width="100%" height={height} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={`Barcode ${value}`}>
      {rects}
    </svg>
  );
}

/* ---------- QR-Code (Byte/Alphanumeric, EC-Level M, ohne externe Bibliothek) ---------- */
const QR = (() => {
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(degree) { const r = new Array(degree).fill(0); r[degree - 1] = 1; let root = 1; for (let i = 0; i < degree; i++) { for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; } root = gfMul(root, 2); } return r; }
  function rsRemainder(data, div) { const r = new Array(div.length).fill(0); for (const b of data) { const f = b ^ r[0]; r.shift(); r.push(0); for (let i = 0; i < r.length; i++) r[i] ^= gfMul(div[i], f); } return r; }
  function rawModules(ver) { let r = (16 * ver + 128) * ver + 64; if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; } return r; }
  const ECC_M = { 1: 10, 2: 16, 3: 26, 4: 18, 5: 24, 6: 16, 7: 18, 8: 22, 9: 22, 10: 26 };
  const BLK_M = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 4, 7: 4, 8: 4, 9: 5, 10: 5 };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  function dataCwCount(ver) { return Math.floor(rawModules(ver) / 8) - ECC_M[ver] * BLK_M[ver]; }
  function isAlnum(s) { for (const c of s) if (ALNUM.indexOf(c) < 0) return false; return true; }
  function chooseVersion(text) {
    const mode = isAlnum(text) ? 'alnum' : 'byte';
    const byteLen = mode === 'byte' ? new TextEncoder().encode(text).length : 0;
    for (let ver = 1; ver <= 10; ver++) {
      const cap = dataCwCount(ver) * 8;
      let need;
      if (mode === 'alnum') { const pairs = Math.floor(text.length / 2); need = 4 + (ver <= 9 ? 9 : 11) + pairs * 11 + (text.length % 2 ? 6 : 0); }
      else { need = 4 + (ver <= 9 ? 8 : 16) + byteLen * 8; }
      if (need <= cap) return { ver, mode };
    }
    return { ver: 10, mode };
  }
  function makeCodewords(text) {
    const { ver, mode } = chooseVersion(text);
    const n = dataCwCount(ver);
    const bb = [];
    const ap = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    if (mode === 'alnum') {
      ap(0b0010, 4); ap(text.length, ver <= 9 ? 9 : 11);
      for (let i = 0; i < text.length;) { if (i + 1 < text.length) { ap(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11); i += 2; } else { ap(ALNUM.indexOf(text[i]), 6); i++; } }
    } else {
      const bytes = Array.from(new TextEncoder().encode(text));
      ap(0b0100, 4); ap(bytes.length, ver <= 9 ? 8 : 16);
      for (const b of bytes) ap(b, 8);
    }
    const cap = n * 8;
    for (let i = 0; i < 4 && bb.length < cap; i++) bb.push(0);
    while (bb.length % 8 !== 0) bb.push(0);
    const cw = [];
    for (let i = 0; i < bb.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bb[i + j]; cw.push(b); }
    const pads = [0xEC, 0x11]; let pi = 0;
    while (cw.length < n) { cw.push(pads[pi % 2]); pi++; }
    return { ver, cw };
  }
  function interleave(data, ver) {
    const nb = BLK_M[ver], ecl = ECC_M[ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const numShort = nb - raw % nb;
    const shortLen = Math.floor(raw / nb);
    const div = rsDivisor(ecl);
    const blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const dl = shortLen - ecl + (i < numShort ? 0 : 1); const dat = data.slice(k, k + dl); k += dl; blocks.push({ dat, ecc: rsRemainder(dat, div) }); }
    const res = [];
    const maxDat = shortLen - ecl + 1;
    for (let i = 0; i < maxDat; i++) for (let j = 0; j < blocks.length; j++) if (i < blocks[j].dat.length) res.push(blocks[j].dat[i]);
    for (let i = 0; i < ecl; i++) for (let j = 0; j < blocks.length; j++) res.push(blocks[j].ecc[i]);
    return res;
  }
  function setFn(m, fn, col, row, val) { m[row][col] = val; fn[row][col] = true; }
  function drawFinder(m, fn, size, cx, cy) { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); const xx = cx + dx, yy = cy + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(m, fn, xx, yy, d !== 2 && d !== 4); } }
  function drawAlign(m, fn, cx, cy) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setFn(m, fn, cx + dx, cy + dy, d !== 1); } }
  function drawFormat(mask, m, fn, size) {
    const dataBits = (0 << 3) | mask;
    let rem = dataBits; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((dataBits << 10) | rem) ^ 0x5412;
    const gb = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i < 15; i++) {
      const mod = gb(i);
      if (i < 6) setFn(m, fn, 8, i, mod);
      else if (i < 8) setFn(m, fn, 8, i + 1, mod);
      else setFn(m, fn, 8, size - 15 + i, mod);
      if (i < 8) setFn(m, fn, size - 1 - i, 8, mod);
      else if (i < 9) setFn(m, fn, 15 - i, 8, mod);
      else setFn(m, fn, 14 - i, 8, mod);
    }
    setFn(m, fn, 8, size - 8, true);
  }
  function drawVersion(ver, m, fn, size) {
    if (ver < 7) return;
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const bit = ((bits >>> i) & 1) !== 0; const a = size - 11 + (i % 3); const b = Math.floor(i / 3); setFn(m, fn, a, b, bit); setFn(m, fn, b, a, bit); }
  }
  function drawFunc(ver, m, fn, size) {
    for (let i = 0; i < size; i++) { const v = (i % 2 === 0); setFn(m, fn, 6, i, v); setFn(m, fn, i, 6, v); }
    drawFinder(m, fn, size, 3, 3); drawFinder(m, fn, size, size - 4, 3); drawFinder(m, fn, size, 3, size - 4);
    const pos = ALIGN[ver]; const np = pos.length;
    for (let i = 0; i < np; i++) for (let j = 0; j < np; j++) { if ((i === 0 && j === 0) || (i === 0 && j === np - 1) || (i === np - 1 && j === 0)) continue; drawAlign(m, fn, pos[i], pos[j]); }
    drawFormat(0, m, fn, size);
    drawVersion(ver, m, fn, size);
  }
  function drawData(data, m, fn, size) {
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j; const upward = ((right + 1) & 2) === 0; const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && i < data.length * 8) { m[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
  }
  function applyMask(mask, m, fn, size) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (fn[y][x]) continue; let inv = false;
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break; case 2: inv = x % 3 === 0; break;
        case 3: inv = (x + y) % 3 === 0; break; case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = ((x * y) % 2 + (x * y) % 3) === 0; break; case 6: inv = (((x * y) % 2 + (x * y) % 3) % 2) === 0; break;
        case 7: inv = (((x + y) % 2 + (x * y) % 3) % 2) === 0; break;
      }
      if (inv) m[y][x] = !m[y][x];
    }
  }
  function penalty(m, size) {
    let p = 0;
    for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (m[y][x] === m[y][x - 1]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; } } if (run >= 5) p += 3 + (run - 5); }
    for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (m[y][x] === m[y - 1][x]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; } } if (run >= 5) p += 3 + (run - 5); }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
    const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const mt = (arr, y, x, h) => { for (let k = 0; k < 11; k++) { const v = h ? m[y][x + k] : m[y + k][x]; if ((v ? 1 : 0) !== arr[k]) return false; } return true; };
    for (let y = 0; y < size; y++) for (let x = 0; x <= size - 11; x++) { if (mt(p1, y, x, true)) p += 40; if (mt(p2, y, x, true)) p += 40; }
    for (let x = 0; x < size; x++) for (let y = 0; y <= size - 11; y++) { if (mt(p1, y, x, false)) p += 40; if (mt(p2, y, x, false)) p += 40; }
    let dark = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
    const ratio = dark / (size * size) * 100; p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return p;
  }
  function encode(text) {
    const { ver, cw } = makeCodewords(String(text == null ? '' : text));
    const all = interleave(cw, ver);
    const size = ver * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    drawFunc(ver, m, fn, size);
    drawData(all, m, fn, size);
    let best = 0, bestS = Infinity;
    for (let mask = 0; mask < 8; mask++) { applyMask(mask, m, fn, size); drawFormat(mask, m, fn, size); const s = penalty(m, size); if (s < bestS) { bestS = s; best = mask; } applyMask(mask, m, fn, size); }
    applyMask(best, m, fn, size); drawFormat(best, m, fn, size);
    return { size, modules: m };
  }
  return { encode };
})();

function QRCode({ value }) {
  let res = null;
  try { res = QR.encode(value || ' '); } catch (e) { res = null; }
  if (!res) return null;
  const { size, modules } = res;
  const quiet = 4;
  const dim = size + quiet * 2;
  const rects = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (modules[y][x]) { let run = 1; while (x + run < size && modules[y][x + run]) run++; rects.push(<rect key={`${y}-${x}`} x={x + quiet} y={y + quiet} width={run} height={1} fill="#000" />); x += run; }
      else x++;
    }
  }
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} width="100%" height="100%" shapeRendering="crispEdges" role="img" aria-label={`QR-Code ${value}`}>
      <rect x="0" y="0" width={dim} height={dim} fill="#fff" />
      {rects}
    </svg>
  );
}

/* ---------- Kleine Bausteine ---------- */
function TagGlyph({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M12 3.5h7.5A1.5 1.5 0 0 1 21 5v7.5a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8-8A2 2 0 0 1 12 3.5Z" fill="currentColor" />
      <circle cx="16.4" cy="7.6" r="1.55" fill="#fff" />
    </svg>
  );
}

function ScanGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" /><path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" /><path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" /><path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="f-lbl">{label}</span>
      {children}
      {hint && <span className="f-hint">{hint}</span>}
    </label>
  );
}

function StatCard({ value, label, accent, active, onClick, sub }) {
  return (
    <button className={`stat ${accent ? `stat-${accent}` : ''} ${active ? 'stat-on' : ''}`} onClick={onClick}>
      <span className="stat-val">{value}</span>
      <span className="stat-lbl">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </button>
  );
}

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function DeviceCard({ g, onLend, onReturn, onEdit }) {
  const st = STATUS[g.status] || STATUS.verfuegbar;
  const ueberf = istUeberfaellig(g);
  return (
    <div className={`card status-${st.cls}`}>
      <span className="card-bar" />
      <div className="card-main">
        <div className="card-top">
          <span className="inv">{g.inventarnummer}</span>
          <span className={`pill pill-${st.cls}`}>{st.label}</span>
          {g.digitalpakt && <span className="tag-dp">DigitalPakt</span>}
        </div>
        <div className="card-modell">
          {g.modell || 'Unbenanntes Gerät'}{g.typ && <span className="card-typ"> · {g.typ}</span>}
        </div>
        <div className="card-meta">
          {g.hersteller && <span>{g.hersteller}</span>}
          {g.seriennummer && <span className="mono">SN {g.seriennummer}</span>}
          {g.standort && <span>{g.standort}</span>}
          {g.anschaffung && <span>Bj. {g.anschaffung}</span>}
        </div>
        {g.status === 'verliehen' && (
          <div className={`leihe ${ueberf ? 'leihe-rot' : ''}`}>
            <span className="leihe-an">↳ {g.ausleiheAn || 'unbekannt'}</span>
            <span className="leihe-bis">Rückgabe bis {fmtDE(g.rueckgabe)}{ueberf && ' · überfällig'}</span>
          </div>
        )}
        {g.notiz && <div className="card-notiz">{g.notiz}</div>}
      </div>
      <div className="card-actions">
        {g.status === 'verliehen'
          ? <button className="btn btn-ghost" onClick={() => onReturn(g)}>Rückgabe</button>
          : g.status === 'verfuegbar'
            ? <button className="btn btn-ghost" onClick={() => onLend(g)}>Ausleihen</button>
            : null}
        <button className="btn btn-icon" onClick={() => onEdit(g)}>Details</button>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

.gv{
  --papier:#F2F4F7;--karte:#FFFFFF;--tinte:#151A24;--nebel:#69718A;--nebel2:#9AA1B4;
  --linie:#E5E8EE;--linie2:#EEF0F4;
  --cobalt:#2A4BE0;--cobalt-tief:#1E37B0;--cobalt-hauch:#EDF0FD;
  --verf:#15803D;--verf-bg:#DCF6E6;--verl:#9A5B08;--verl-bg:#FBEFD2;--rep:#BE2A22;--rep-bg:#FBE6E4;--aus:#4B5565;--aus-bg:#E7EAEF;
  --r:11px;--r-sm:8px;
  --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  font-family:var(--sans);color:var(--tinte);background:var(--papier);min-height:100vh;-webkit-font-smoothing:antialiased;line-height:1.45;
}
.gv *{box-sizing:border-box;}
.gv button{font-family:inherit;cursor:pointer;}
.gv button:focus-visible,.gv input:focus-visible,.gv select:focus-visible,.gv textarea:focus-visible{outline:2px solid var(--cobalt);outline-offset:2px;}
.gv .mono{font-family:var(--mono);}
.wrap{max-width:1080px;margin:0 auto;padding:22px 20px 60px;}

.header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--linie);flex-wrap:wrap;}
.brand{display:flex;align-items:center;gap:12px;}
.logo{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--cobalt);color:#fff;box-shadow:0 2px 6px rgba(42,75,224,.28);}
.brand-title{font-size:19px;font-weight:700;letter-spacing:-.01em;}
.brand-sub{font-size:12px;color:var(--nebel);font-family:var(--mono);letter-spacing:.01em;}
.header-right{display:flex;align-items:center;gap:10px;}
.schuljahr{font-family:var(--mono);font-size:12px;color:var(--nebel);background:var(--karte);border:1px solid var(--linie);padding:6px 10px;border-radius:999px;}

.btn{border:1px solid transparent;border-radius:var(--r-sm);padding:9px 14px;font-size:13.5px;font-weight:600;line-height:1;transition:.15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
.btn-primary{background:var(--cobalt);color:#fff;}
.btn-primary:hover{background:var(--cobalt-tief);}
.btn-ghost{background:var(--karte);color:var(--tinte);border-color:var(--linie);}
.btn-ghost:hover{border-color:var(--nebel2);background:#FAFBFC;}
.btn-icon{background:transparent;color:var(--nebel);border-color:var(--linie);padding:9px 12px;}
.btn-icon:hover{color:var(--tinte);border-color:var(--nebel2);}
.btn-danger-ghost{background:transparent;color:var(--rep);border-color:var(--rep-bg);}
.btn-danger-ghost:hover{background:var(--rep-bg);}
.btn-danger{background:var(--rep);color:#fff;}
.btn-danger:hover{background:#A0221B;}
.btn.sm{padding:7px 11px;font-size:12.5px;}

.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0 16px;}
.stat{text-align:left;background:var(--karte);border:1px solid var(--linie);border-radius:var(--r);padding:13px 14px;display:flex;flex-direction:column;gap:2px;transition:.15s;}
.stat:hover{border-color:var(--nebel2);}
.stat-on{border-color:var(--cobalt);background:var(--cobalt-hauch);}
.stat-val{font-family:var(--mono);font-size:25px;font-weight:600;letter-spacing:-.02em;line-height:1.1;}
.stat-lbl{font-size:12px;color:var(--nebel);}
.stat-sub{font-size:11px;color:var(--rep);font-weight:600;margin-top:1px;}
.stat-cobalt .stat-val{color:var(--cobalt);}.stat-verf .stat-val{color:var(--verf);}.stat-verl .stat-val{color:var(--verl);}.stat-rep .stat-val{color:var(--rep);}.stat-aus .stat-val{color:var(--aus);}

.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.search{position:relative;flex:1 1 240px;display:flex;align-items:center;}
.search>svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--nebel2);pointer-events:none;}
.search-inp{width:100%;padding:10px 32px 10px 34px;border:1px solid var(--linie);border-radius:var(--r-sm);background:var(--karte);font-size:13.5px;font-family:inherit;color:var(--tinte);}
.search-inp:focus{outline:none;border-color:var(--cobalt);box-shadow:0 0 0 3px var(--cobalt-hauch);}
.search-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--nebel2);font-size:13px;padding:4px 6px;line-height:1;}
.search-clear:hover{color:var(--tinte);}
.sel{background:var(--karte);border:1px solid var(--linie);border-radius:var(--r-sm);padding:10px 12px;font-size:13px;color:var(--tinte);font-family:inherit;}
.sel:focus{outline:none;border-color:var(--cobalt);box-shadow:0 0 0 3px var(--cobalt-hauch);}
.tb-spacer{flex:1 1 0;}
.toggle-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--rep-bg);background:var(--rep-bg);color:var(--rep);border-radius:var(--r-sm);padding:9px 12px;font-size:12.5px;font-weight:600;}
.toggle-chip:hover{border-color:var(--rep);}
.toggle-chip.on{background:var(--rep);color:#fff;border-color:var(--rep);}

.result-line{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 10px;font-size:12.5px;color:var(--nebel);font-family:var(--mono);gap:10px;}
.link{background:none;border:none;color:var(--cobalt);font-weight:600;font-size:12.5px;font-family:var(--sans);padding:0;}
.link:hover{text-decoration:underline;}
.link-danger{color:var(--rep);}

.list{display:flex;flex-direction:column;gap:9px;}
.card{display:flex;background:var(--karte);border:1px solid var(--linie);border-radius:var(--r);overflow:hidden;transition:.15s;}
.card:hover{border-color:var(--nebel2);box-shadow:0 1px 3px rgba(20,26,40,.05);}
.card-bar{width:4px;flex:none;background:var(--nebel2);}
.status-verf .card-bar{background:var(--verf);}.status-verl .card-bar{background:var(--verl);}.status-rep .card-bar{background:var(--rep);}.status-aus .card-bar{background:var(--aus);}
.card-main{flex:1;padding:13px 16px;min-width:0;}
.card-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.inv{font-family:var(--mono);font-size:14.5px;font-weight:600;letter-spacing:-.01em;}
.pill{font-family:var(--mono);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;}
.pill-verf{color:var(--verf);background:var(--verf-bg);}.pill-verl{color:var(--verl);background:var(--verl-bg);}.pill-rep{color:var(--rep);background:var(--rep-bg);}.pill-aus{color:var(--aus);background:var(--aus-bg);}
.tag-dp{font-size:10px;font-weight:600;color:var(--cobalt);background:var(--cobalt-hauch);padding:3px 7px;border-radius:999px;letter-spacing:.02em;}
.card-modell{font-size:14.5px;font-weight:600;margin-top:5px;}
.card-typ{color:var(--nebel);font-weight:400;font-size:13px;}
.card-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:12px;color:var(--nebel);}
.card-meta .mono{font-size:11.5px;}
.leihe{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed var(--linie);font-size:12px;}
.leihe-an{font-weight:600;color:var(--tinte);}
.leihe-bis{color:var(--nebel);}
.leihe-rot .leihe-bis{color:var(--rep);font-weight:600;}
.card-notiz{margin-top:7px;font-size:12px;color:var(--nebel);font-style:italic;}
.card-actions{display:flex;align-items:center;gap:8px;padding:13px 14px;border-left:1px solid var(--linie2);flex:none;}

.empty{text-align:center;padding:60px 20px;max-width:430px;margin:30px auto;}
.empty-ico{color:var(--cobalt);opacity:.9;margin-bottom:4px;}
.empty h2{font-size:18px;margin:8px 0 6px;}
.empty p{color:var(--nebel);font-size:13.5px;margin-bottom:20px;line-height:1.5;}
.empty-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}
.noresult{text-align:center;color:var(--nebel);padding:40px;font-size:13.5px;}

.footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:30px;padding-top:16px;border-top:1px solid var(--linie);font-size:11.5px;color:var(--nebel2);font-family:var(--mono);flex-wrap:wrap;}

.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:90px 20px;color:var(--nebel);font-size:13.5px;}
.spinner{width:26px;height:26px;border:2.5px solid var(--linie);border-top-color:var(--cobalt);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.overlay{position:fixed;inset:0;background:rgba(21,26,36,.42);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;z-index:50;backdrop-filter:blur(2px);}
.modal{background:var(--karte);border-radius:14px;width:100%;max-width:480px;box-shadow:0 18px 50px rgba(21,26,36,.25);animation:pop .16s ease-out;margin:auto 0;}
.modal-wide{max-width:560px;}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--linie);}
.modal-head h2{font-size:16px;font-weight:700;}
.x{background:none;border:none;color:var(--nebel);font-size:15px;padding:4px 6px;border-radius:6px;}
.x:hover{background:var(--linie2);color:var(--tinte);}
.modal-body{padding:20px;display:flex;flex-direction:column;gap:14px;}
.modal-foot{display:flex;align-items:center;gap:10px;padding:16px 20px;border-top:1px solid var(--linie);}
.foot-spacer{flex:1;}

.field{display:flex;flex-direction:column;gap:5px;}
.f-lbl{font-size:12px;font-weight:600;color:var(--tinte);}
.f-hint{font-size:11px;color:var(--nebel);line-height:1.4;}
.inp{border:1px solid var(--linie);border-radius:var(--r-sm);padding:9px 11px;font-size:13.5px;font-family:inherit;color:var(--tinte);background:var(--karte);width:100%;}
.inp:focus{outline:none;border-color:var(--cobalt);box-shadow:0 0 0 3px var(--cobalt-hauch);}
.inp.mono{font-family:var(--mono);}
.ta{resize:vertical;min-height:60px;line-height:1.5;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.check{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--tinte);align-self:end;padding-bottom:9px;}
.check input{width:16px;height:16px;accent-color:var(--cobalt);}
.err{background:var(--rep-bg);color:var(--rep);font-size:12.5px;font-weight:500;padding:9px 12px;border-radius:var(--r-sm);}
.leih-info{font-size:13px;color:var(--nebel);background:var(--linie2);padding:10px 12px;border-radius:var(--r-sm);}
.leih-info .mono{color:var(--tinte);font-weight:600;}
.confirm-txt{font-size:13.5px;color:var(--tinte);line-height:1.55;}

.presets{display:flex;flex-direction:column;gap:7px;}
.presets-lbl{font-size:11px;color:var(--nebel);font-weight:600;}
.chips{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}
.chip{display:inline-flex;align-items:center;background:var(--linie2);border:1px solid var(--linie);border-radius:999px;overflow:hidden;}
.chip-fill{background:none;border:none;padding:6px 4px 6px 12px;font-size:12.5px;color:var(--tinte);font-family:inherit;}
.chip-fill:hover{color:var(--cobalt);}
.chip-x{background:none;border:none;color:var(--nebel2);font-size:11px;padding:6px 9px 6px 5px;line-height:1;}
.chip-x:hover{color:var(--rep);}
.chip-add{display:inline-flex;align-items:center;gap:5px;background:var(--cobalt-hauch);border:1px dashed var(--cobalt);color:var(--cobalt);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;font-family:inherit;}
.chip-add:hover{background:#E3E8FD;}
.chips-empty{font-size:12px;color:var(--nebel);}

.scan-hint{font-size:12.5px;color:var(--nebel);line-height:1.5;}
.scan-actions{display:flex;gap:10px;flex-wrap:wrap;}
.scan-video{width:100%;border-radius:var(--r-sm);background:#000;max-height:240px;object-fit:cover;border:1px solid var(--linie);}
.scan-note{font-size:12.5px;color:var(--nebel);background:var(--linie2);padding:10px 12px;border-radius:var(--r-sm);line-height:1.5;}
.scan-ok{font-size:12.5px;color:var(--verf);background:var(--verf-bg);padding:10px 12px;border-radius:var(--r-sm);font-weight:600;}

.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--tinte);color:#fff;font-size:13px;font-weight:500;padding:11px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(21,26,36,.3);z-index:60;animation:toastin .2s ease-out;}
.toast-ok{background:var(--verf);}.toast-warn{background:var(--verl);}
@keyframes toastin{from{opacity:0;}to{opacity:1;}}

@media (max-width:760px){
  .stats{grid-template-columns:repeat(3,1fr);}
  .card{flex-wrap:wrap;}
  .card-actions{border-left:none;border-top:1px solid var(--linie2);width:100%;padding:10px 16px;}
  .grid2{grid-template-columns:1fr;}
}
@media (max-width:460px){
  .wrap{padding:16px 13px 50px;}
  .stats{grid-template-columns:repeat(2,1fr);}
  .header-right{width:100%;justify-content:space-between;}
  .stat-val{font-size:22px;}
}
.btn:disabled{opacity:.5;cursor:not-allowed;}

.labels-overlay{position:fixed;inset:0;background:#EAECEF;z-index:70;display:flex;flex-direction:column;}
.labels-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:var(--karte);border-bottom:1px solid var(--linie);flex-wrap:wrap;}
.labels-bar-l{display:flex;flex-direction:column;gap:1px;}
.labels-bar-l strong{font-size:14px;}
.labels-count{font-size:12px;color:var(--nebel);font-family:var(--mono);}
.labels-bar-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.labels-school{width:170px;}
.seg{display:inline-flex;border:1px solid var(--linie);border-radius:var(--r-sm);overflow:hidden;}
.seg-btn{background:var(--karte);border:none;padding:8px 12px;font-size:12.5px;font-weight:600;color:var(--nebel);}
.seg-btn.on{background:var(--cobalt);color:#fff;}
.labels-scroll{flex:1;overflow-y:auto;padding:22px;}
.labels-hint{max-width:760px;margin:0 auto 18px;font-size:12px;color:var(--nebel);background:var(--karte);border:1px solid var(--linie);border-radius:var(--r-sm);padding:10px 13px;line-height:1.5;}
.labels-sheet{display:flex;flex-wrap:wrap;gap:4mm;justify-content:center;align-content:flex-start;background:#fff;padding:8mm;border-radius:8px;max-width:max-content;margin:0 auto;box-shadow:0 4px 18px rgba(21,26,36,.1);}
.label{box-sizing:border-box;border:1px dashed #C7CCD6;border-radius:2mm;padding:2.4mm 3mm;background:#fff;display:flex;flex-direction:column;justify-content:space-between;break-inside:avoid;page-break-inside:avoid;color:#000;overflow:hidden;}
.label-standard{width:70mm;height:32mm;}
.label-klein{width:52mm;height:26mm;}
.label-head{display:flex;align-items:baseline;justify-content:space-between;gap:4px;}
.label-school{font-size:7.5pt;font-weight:700;letter-spacing:.01em;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.label-typ{font-size:6.5pt;color:#555;white-space:nowrap;flex:none;}
.label-barcode{width:100%;height:11mm;display:flex;align-items:center;}
.label-barcode svg{display:block;width:100%;height:100%;}
.label-inv{font-size:9.5pt;font-weight:600;letter-spacing:.03em;text-align:center;color:#000;}
.label-sub{font-size:6.5pt;color:#444;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.label-klein .label-barcode{height:9mm;}
.label-klein .label-inv{font-size:8pt;}
.label-klein .label-school{font-size:7pt;}
.label-mode-qr{flex-direction:row;align-items:stretch;gap:3mm;justify-content:flex-start;}
.label-qr-code{height:100%;aspect-ratio:1/1;flex:none;display:flex;align-items:center;justify-content:center;}
.label-qr-code svg{display:block;width:100%;height:100%;}
.label-qr-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:.8mm;overflow:hidden;}
.label-qr-info .label-inv{text-align:left;}
.label-qr-info .label-sub{text-align:left;}
.label-qr-head{display:flex;flex-direction:column;gap:.4mm;}
.label-qr-head .label-typ{white-space:normal;}

@media (prefers-reduced-motion:reduce){.gv *{animation:none!important;transition:none!important;}}

@media print{
  @page{margin:10mm;}
  .gv.mode-labels{background:#fff;}
  .gv.mode-labels .wrap{display:none !important;}
  .gv.mode-labels .overlay{display:none !important;}
  .gv.mode-labels .toast{display:none !important;}
  .gv.mode-labels .no-print{display:none !important;}
  .gv.mode-labels .labels-overlay{position:static;background:#fff;}
  .gv.mode-labels .labels-scroll{overflow:visible;padding:0;}
  .gv.mode-labels .labels-sheet{box-shadow:none;padding:0;gap:4mm;max-width:none;border-radius:0;justify-content:flex-start;}
  .gv.mode-labels .label{border:1px solid #BBB;}
}
`;

/* ---------- App ---------- */
export default function App() {
  const [devices, setDevices] = useState([]);
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [filterTyp, setFilterTyp] = useState('alle');
  const [filterRaum, setFilterRaum] = useState('alle');
  const [nurUeberfaellig, setNurUeberfaellig] = useState(false);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(LEER);
  const [formError, setFormError] = useState('');
  const [lendTarget, setLendTarget] = useState(null);
  const [lendForm, setLendForm] = useState({ ausleiheAn: '', rueckgabe: '' });
  const [lendError, setLendError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanMsg, setScanMsg] = useState(null);
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState('');

  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelSize, setLabelSize] = useState('standard');
  const [codeType, setCodeType] = useState('barcode');
  const [schoolName, setSchoolName] = useState('');

  const hydrated = useRef(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);

  const KEY = 'geraete:inventar:v1';
  const PKEY = 'geraete:ausleiher:v1';
  const SKEY = 'geraete:schule:v1';

  /* --- Laden --- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window !== 'undefined' && window.storage) {
        try {
          const res = await window.storage.get(KEY);
          if (!cancelled && res && res.value) { const p = JSON.parse(res.value); if (Array.isArray(p)) setDevices(p); }
        } catch (e) { /* noch kein Eintrag */ }
        try {
          const pr = await window.storage.get(PKEY);
          if (!cancelled && pr && pr.value) { const p = JSON.parse(pr.value); if (Array.isArray(p)) setPresets(p); }
        } catch (e) { /* Standard-Vorlagen bleiben */ }
        try {
          const sc = await window.storage.get(SKEY);
          if (!cancelled && sc && sc.value) { const v = JSON.parse(sc.value); if (typeof v === 'string') setSchoolName(v); }
        } catch (e) { /* kein Schulname gespeichert */ }
      }
      if (!cancelled) { setLoading(false); hydrated.current = true; }
    })();
    return () => { cancelled = true; };
  }, []);

  /* --- Speichern --- */
  useEffect(() => {
    if (!hydrated.current) return;
    if (typeof window === 'undefined' || !window.storage) return;
    (async () => { try { await window.storage.set(KEY, JSON.stringify(devices)); } catch (e) { console.error('Speichern fehlgeschlagen:', e); } })();
  }, [devices]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (typeof window === 'undefined' || !window.storage) return;
    (async () => { try { await window.storage.set(PKEY, JSON.stringify(presets)); } catch (e) { /* ignore */ } })();
  }, [presets]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (typeof window === 'undefined' || !window.storage) return;
    (async () => { try { await window.storage.set(SKEY, JSON.stringify(schoolName)); } catch (e) { /* ignore */ } })();
  }, [schoolName]);

  /* --- Toast automatisch ausblenden --- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  /* --- Escape schließt offene Ebenen --- */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setConfirmDelete(null); setShowInfo(false); closeModal(); closeScan(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* --- Kamera beim Verlassen stoppen --- */
  useEffect(() => () => stopCamera(), []);

  /* --- überfällig-Filter zurücksetzen, wenn keine überfälligen Geräte mehr --- */
  const stats = useMemo(() => {
    const s = { gesamt: devices.length, verfuegbar: 0, verliehen: 0, reparatur: 0, ausgemustert: 0, ueberfaellig: 0 };
    devices.forEach((g) => { s[g.status] = (s[g.status] || 0) + 1; if (istUeberfaellig(g)) s.ueberfaellig++; });
    return s;
  }, [devices]);

  useEffect(() => { if (stats.ueberfaellig === 0 && nurUeberfaellig) setNurUeberfaellig(false); }, [stats.ueberfaellig, nurUeberfaellig]);

  const raeume = useMemo(() => Array.from(new Set(devices.map((g) => g.standort).filter(Boolean))).sort(), [devices]);

  const gefiltert = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((g) => {
      if (nurUeberfaellig && !istUeberfaellig(g)) return false;
      if (filterStatus !== 'alle' && g.status !== filterStatus) return false;
      if (filterTyp !== 'alle' && g.typ !== filterTyp) return false;
      if (filterRaum !== 'alle' && g.standort !== filterRaum) return false;
      if (!q) return true;
      return [g.inventarnummer, g.modell, g.hersteller, g.seriennummer, g.standort, g.ausleiheAn]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [devices, query, filterStatus, filterTyp, filterRaum, nurUeberfaellig]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openAdd() {
    const jahr = new Date().getFullYear();
    const nr = `IT-${jahr}-${String(devices.length + 1).padStart(4, '0')}`;
    setForm({ ...LEER, inventarnummer: nr, anschaffung: String(jahr) });
    setFormError(''); setEditing(null); setModal('add');
  }
  function openAddWith(inv) {
    closeScan();
    const jahr = new Date().getFullYear();
    setForm({ ...LEER, inventarnummer: inv, anschaffung: String(jahr) });
    setFormError(''); setEditing(null); setModal('add');
  }
  function openEdit(g) { setForm({ ...g }); setEditing(g); setFormError(''); setModal('edit'); }
  function openLend(g) { setLendTarget(g); setLendForm({ ausleiheAn: '', rueckgabe: inTagen(14) }); setLendError(''); setModal('lend'); }
  function closeModal() { setModal(null); setEditing(null); setLendTarget(null); setFormError(''); setLendError(''); }
  function resetFilters() { setQuery(''); setFilterStatus('alle'); setFilterTyp('alle'); setFilterRaum('alle'); setNurUeberfaellig(false); }

  function saveForm() {
    if (!form.inventarnummer.trim()) { setFormError('Bitte eine Inventarnummer angeben.'); return; }
    const clean = { ...form, inventarnummer: form.inventarnummer.trim() };
    if (clean.status !== 'verliehen') { clean.ausleiheAn = ''; clean.ausleiheVon = ''; clean.rueckgabe = ''; }
    if (modal === 'add') {
      setDevices((d) => [{ ...clean, id: uid() }, ...d]);
      setToast({ msg: 'Gerät hinzugefügt.', kind: 'ok' });
    } else {
      setDevices((d) => d.map((g) => (g.id === clean.id ? clean : g)));
      setToast({ msg: 'Änderungen gespeichert.', kind: 'ok' });
    }
    closeModal();
  }

  function confirmLend() {
    if (!lendForm.ausleiheAn.trim()) { setLendError('Bitte angeben, an wen ausgeliehen wird.'); return; }
    const an = lendForm.ausleiheAn.trim();
    setDevices((d) => d.map((g) => (g.id === lendTarget.id ? { ...g, status: 'verliehen', ausleiheAn: an, ausleiheVon: heute(), rueckgabe: lendForm.rueckgabe } : g)));
    setToast({ msg: `Ausgeliehen an ${an}.`, kind: 'ok' });
    closeModal();
  }

  function rueckgabe(g) {
    setDevices((d) => d.map((x) => (x.id === g.id ? { ...x, status: 'verfuegbar', ausleiheAn: '', ausleiheVon: '', rueckgabe: '' } : x)));
    setToast({ msg: 'Gerät zurückgenommen.', kind: 'ok' });
  }

  function doDelete() {
    setDevices((d) => d.filter((g) => g.id !== confirmDelete.id));
    setToast({ msg: 'Gerät gelöscht.', kind: 'warn' });
    setConfirmDelete(null);
    if (modal === 'edit') closeModal();
  }

  function loadSamples() {
    setDevices(BEISPIELE.map((b) => ({ ...b, id: uid() })));
    setToast({ msg: 'Beispieldaten geladen.', kind: 'ok' });
  }

  function clearAll() {
    if (typeof window !== 'undefined' && window.confirm('Wirklich alle Geräte und Ausleihdaten unwiderruflich löschen?')) {
      setDevices([]); resetFilters();
      setToast({ msg: 'Alle Daten gelöscht.', kind: 'warn' });
    }
  }

  /* --- Vorlagen --- */
  function addPreset() {
    const v = lendForm.ausleiheAn.trim();
    if (v && !presets.includes(v)) setPresets((ps) => [...ps, v]);
  }
  function removePreset(p) { setPresets((ps) => ps.filter((x) => x !== p)); }

  /* --- CSV Export --- */
  function exportCSV() {
    const headers = ['Inventarnummer', 'Typ', 'Modell', 'Hersteller', 'Seriennummer', 'Standort', 'Status', 'Ausgeliehen an', 'Ausleihe von', 'Rueckgabe bis', 'DigitalPakt', 'Anschaffung', 'Notiz'];
    const rows = devices.map((g) => [g.inventarnummer, g.typ, g.modell, g.hersteller, g.seriennummer, g.standort, STATUS[g.status]?.label || g.status, g.ausleiheAn || '', g.ausleiheVon || '', g.rueckgabe || '', g.digitalpakt ? 'ja' : 'nein', g.anschaffung || '', (g.notiz || '').replace(/\n/g, ' ')]);
    const esc = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `geraete-inventar_${heute()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setToast({ msg: 'Inventar als CSV exportiert.', kind: 'ok' });
  }

  /* --- CSV Import (Upsert nach Inventarnummer) --- */
  function triggerImport() { if (fileRef.current) fileRef.current.click(); }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let text = String(reader.result || '');
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const firstLine = text.split(/\r?\n/)[0] || '';
        const delim = firstLine.includes(';') ? ';' : ',';
        const rows = parseCSV(text, delim).filter((r) => r.some((c) => (c || '').trim() !== ''));
        if (rows.length < 2) { setToast({ msg: 'Keine Daten in der CSV gefunden.', kind: 'warn' }); return; }
        const header = rows[0].map((h) => (h || '').trim().toLowerCase());
        const idx = (names) => { for (const nm of names) { const j = header.indexOf(nm); if (j >= 0) return j; } return -1; };
        const col = {
          inv: idx(['inventarnummer', 'inventarnr.', 'inventarnr', 'inv-nr', 'inv.nr']),
          typ: idx(['typ', 'gerätetyp', 'geraetetyp', 'kategorie']),
          modell: idx(['modell', 'model', 'bezeichnung']),
          hersteller: idx(['hersteller', 'marke']),
          sn: idx(['seriennummer', 'seriennr.', 'seriennr', 'sn', 's/n']),
          standort: idx(['standort', 'raum', 'standort / raum', 'ort']),
          status: idx(['status', 'zustand']),
          an: idx(['ausgeliehen an', 'ausleihe an', 'entliehen an', 'nutzer']),
          von: idx(['ausleihe von', 'ausgeliehen am', 'ausleihdatum']),
          rueck: idx(['rueckgabe bis', 'rückgabe bis', 'rueckgabe', 'rückgabe', 'faellig']),
          dp: idx(['digitalpakt']),
          bj: idx(['anschaffung', 'anschaffungsjahr', 'baujahr', 'bj.', 'jahr']),
          notiz: idx(['notiz', 'bemerkung', 'anmerkung', 'kommentar']),
        };
        if (col.inv < 0) { setToast({ msg: 'Spalte „Inventarnummer“ fehlt in der CSV.', kind: 'warn' }); return; }
        const labelToKey = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [v.label.toLowerCase(), k]));
        const get = (r, j) => (j >= 0 && j < r.length ? String(r[j] ?? '').trim() : '');
        const parseStatus = (s) => { const t = s.trim().toLowerCase(); if (STATUS[t]) return t; if (labelToKey[t]) return labelToKey[t]; return 'verfuegbar'; };
        const parseDP = (s) => /^(ja|yes|true|1|x)$/i.test(s.trim());
        const normDate = (s) => {
          const t = (s || '').trim(); if (!t) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
          const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
          if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
          return t;
        };
        const imported = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const inv = get(row, col.inv);
          if (!inv) continue;
          const status = parseStatus(get(row, col.status));
          imported.push({
            inventarnummer: inv,
            typ: get(row, col.typ) || 'Sonstiges',
            modell: get(row, col.modell),
            hersteller: get(row, col.hersteller),
            seriennummer: get(row, col.sn),
            standort: get(row, col.standort),
            status,
            ausleiheAn: status === 'verliehen' ? get(row, col.an) : '',
            ausleiheVon: status === 'verliehen' ? normDate(get(row, col.von)) : '',
            rueckgabe: status === 'verliehen' ? normDate(get(row, col.rueck)) : '',
            digitalpakt: parseDP(get(row, col.dp)),
            anschaffung: get(row, col.bj),
            notiz: get(row, col.notiz),
          });
        }
        if (imported.length === 0) { setToast({ msg: 'Keine gültigen Geräte gefunden.', kind: 'warn' }); return; }
        let neu = 0, akt = 0;
        const merged = new Map(devices.map((g) => [g.inventarnummer, g]));
        imported.forEach((d) => {
          if (merged.has(d.inventarnummer)) { merged.set(d.inventarnummer, { ...merged.get(d.inventarnummer), ...d }); akt++; }
          else { merged.set(d.inventarnummer, { ...d, id: uid() }); neu++; }
        });
        setDevices(Array.from(merged.values()));
        setToast({ msg: `${imported.length} Geräte importiert (${neu} neu, ${akt} aktualisiert).`, kind: 'ok' });
      } catch (e) {
        console.error(e);
        setToast({ msg: 'CSV konnte nicht gelesen werden.', kind: 'warn' });
      }
    };
    reader.onerror = () => setToast({ msg: 'Datei konnte nicht gelesen werden.', kind: 'warn' });
    reader.readAsText(file, 'utf-8');
  }

  /* --- Scannen --- */
  function openScan() { setScanMsg(null); setScanValue(''); setCamError(''); setScanOpen(true); }
  function closeScan() { stopCamera(); setScanOpen(false); setScanValue(''); setScanMsg(null); setCamError(''); }

  function openLabels() { setLabelsOpen(true); }
  function closeLabels() { setLabelsOpen(false); }

  function doScan(value) {
    const v = (value || '').trim();
    if (!v) return;
    const found = devices.find((g) => (g.inventarnummer || '').toLowerCase() === v.toLowerCase());
    if (found) {
      closeScan();
      setQuery(found.inventarnummer);
      setFilterStatus('alle'); setFilterTyp('alle'); setFilterRaum('alle'); setNurUeberfaellig(false);
      setToast({ msg: `Gerät gefunden: ${found.inventarnummer}`, kind: 'ok' });
    } else {
      setScanMsg({ kind: 'notfound', inv: v });
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    setCamActive(false);
    const s = streamRef.current;
    if (s) { try { s.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ } streamRef.current = null; }
  }

  async function toggleCamera() {
    if (camActive) { stopCamera(); return; }
    setCamError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError('Kamera wird von diesem Browser nicht unterstützt. Bitte Handscanner verwenden oder Nummer manuell eingeben.');
      return;
    }
    if (!('BarcodeDetector' in window)) {
      setCamError('Automatische Code-Erkennung wird auf diesem Gerät/Browser nicht unterstützt. Ein Handscanner (Tastatur-Modus) oder die manuelle Eingabe funktioniert überall.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCamActive(true);
      scanningRef.current = true;
      setTimeout(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try { await video.play(); } catch (e) { /* ignore */ }
        let detector;
        try { detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'codabar', 'itf'] }); }
        catch (e) { try { detector = new window.BarcodeDetector(); } catch (e2) { setCamError('Code-Erkennung nicht verfügbar.'); stopCamera(); return; } }
        const tick = async () => {
          if (!scanningRef.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length) {
              const val = codes[0].rawValue || '';
              stopCamera();
              setScanValue(val);
              doScan(val);
              return;
            }
          } catch (e) { /* einzelner Frame fehlgeschlagen */ }
          if (scanningRef.current) setTimeout(tick, 250);
        };
        tick();
      }, 60);
    } catch (e) {
      setCamError('Kein Kamerazugriff erhalten. Bitte Berechtigung erteilen – oder Handscanner / manuelle Eingabe nutzen.');
      setCamActive(false);
    }
  }

  const filterAktiv = filterStatus !== 'alle' || filterTyp !== 'alle' || filterRaum !== 'alle' || nurUeberfaellig || query.trim() !== '';

  return (
    <div className={`gv ${labelsOpen ? 'mode-labels' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleImportFile(f); e.target.value = ''; }} />

      <div className="wrap">
        <header className="header">
          <div className="brand">
            <span className="logo"><TagGlyph size={20} /></span>
            <div>
              <div className="brand-title">Geräteverwaltung</div>
              <div className="brand-sub">Schul-IT · Inventar &amp; Ausleihe</div>
            </div>
          </div>
          <div className="header-right">
            <span className="schuljahr">Schuljahr 2025/26</span>
            <button className="btn btn-ghost sm" onClick={() => setShowInfo(true)}>Datenschutz</button>
          </div>
        </header>

        {loading ? (
          <div className="loader"><span className="spinner" /><span>Inventar wird geladen …</span></div>
        ) : devices.length === 0 ? (
          <div className="empty">
            <div className="empty-ico"><TagGlyph size={52} /></div>
            <h2>Noch keine Geräte erfasst</h2>
            <p>Lege das erste Gerät an oder lade Beispieldaten, um das Werkzeug auszuprobieren. Alle Daten bleiben lokal in diesem Browser.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={openAdd}>Gerät hinzufügen</button>
              <button className="btn btn-ghost" onClick={loadSamples}>Beispieldaten laden</button>
            </div>
            <button className="link" onClick={triggerImport}>Bestehende Liste als CSV importieren</button>
          </div>
        ) : (
          <>
            <section className="stats">
              <StatCard value={stats.gesamt} label="Geräte gesamt" accent="cobalt" active={filterStatus === 'alle' && !nurUeberfaellig} onClick={() => { setFilterStatus('alle'); setNurUeberfaellig(false); }} />
              <StatCard value={stats.verfuegbar} label="verfügbar" accent="verf" active={filterStatus === 'verfuegbar'} onClick={() => setFilterStatus('verfuegbar')} />
              <StatCard value={stats.verliehen} label="verliehen" accent="verl" active={filterStatus === 'verliehen'} onClick={() => setFilterStatus('verliehen')} sub={stats.ueberfaellig > 0 ? `${stats.ueberfaellig} überfällig` : null} />
              <StatCard value={stats.reparatur} label="in Reparatur" accent="rep" active={filterStatus === 'reparatur'} onClick={() => setFilterStatus('reparatur')} />
              <StatCard value={stats.ausgemustert} label="ausgemustert" accent="aus" active={filterStatus === 'ausgemustert'} onClick={() => setFilterStatus('ausgemustert')} />
            </section>

            <section className="toolbar">
              <span className="search">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
                <input className="search-inp" placeholder="Inventarnr., Modell, Seriennr., Raum oder Person …" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Suche leeren">✕</button>}
              </span>
              <select className="sel" value={filterTyp} onChange={(e) => setFilterTyp(e.target.value)} aria-label="Typ filtern">
                <option value="alle">Alle Typen</option>
                {TYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="sel" value={filterRaum} onChange={(e) => setFilterRaum(e.target.value)} aria-label="Raum filtern">
                <option value="alle">Alle Räume</option>
                {raeume.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {stats.ueberfaellig > 0 && (
                <button className={`toggle-chip ${nurUeberfaellig ? 'on' : ''}`} onClick={() => setNurUeberfaellig((v) => !v)} aria-pressed={nurUeberfaellig}>
                  ⚠ {stats.ueberfaellig} überfällig
                </button>
              )}
              <span className="tb-spacer" />
              <button className="btn btn-ghost" onClick={openScan}><ScanGlyph /> Scannen</button>
              <button className="btn btn-ghost" onClick={openLabels}>Etiketten</button>
              <button className="btn btn-ghost" onClick={triggerImport}>Import</button>
              <button className="btn btn-ghost" onClick={exportCSV}>Export</button>
              <button className="btn btn-primary" onClick={openAdd}>+ Gerät</button>
            </section>

            <div className="result-line">
              <span>{gefiltert.length} von {devices.length} Geräten{nurUeberfaellig ? ' · nur überfällig' : ''}</span>
              {filterAktiv && <button className="link" onClick={resetFilters}>Filter zurücksetzen</button>}
            </div>

            {gefiltert.length > 0 ? (
              <div className="list">
                {gefiltert.map((g) => <DeviceCard key={g.id} g={g} onLend={openLend} onReturn={rueckgabe} onEdit={openEdit} />)}
              </div>
            ) : (
              <div className="noresult">Keine Geräte gefunden. <button className="link" onClick={resetFilters}>Filter zurücksetzen</button></div>
            )}

            <footer className="footer">
              <span>Daten lokal in diesem Browser · keine Übertragung an Dritte</span>
              <button className="link link-danger" onClick={clearAll}>Alle Daten löschen</button>
            </footer>
          </>
        )}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={modal === 'add' ? 'Gerät hinzufügen' : 'Gerät bearbeiten'}
          onClose={closeModal}
          footer={
            <>
              {modal === 'edit' && <button className="btn btn-danger-ghost" onClick={() => setConfirmDelete(editing)}>Löschen</button>}
              <span className="foot-spacer" />
              <button className="btn btn-ghost" onClick={closeModal}>Abbrechen</button>
              <button className="btn btn-primary" onClick={saveForm}>{modal === 'add' ? 'Gerät anlegen' : 'Speichern'}</button>
            </>
          }
        >
          <Field label="Inventarnummer *">
            <input className="inp mono" value={form.inventarnummer} onChange={(e) => upd('inventarnummer', e.target.value)} placeholder="z. B. IT-2026-0042" />
          </Field>
          <div className="grid2">
            <Field label="Gerätetyp">
              <select className="inp" value={form.typ} onChange={(e) => upd('typ', e.target.value)}>
                {TYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="inp" value={form.status} onChange={(e) => upd('status', e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid2">
            <Field label="Hersteller"><input className="inp" value={form.hersteller} onChange={(e) => upd('hersteller', e.target.value)} placeholder="z. B. Apple" /></Field>
            <Field label="Modell"><input className="inp" value={form.modell} onChange={(e) => upd('modell', e.target.value)} placeholder="z. B. iPad 9. Gen" /></Field>
          </div>
          <div className="grid2">
            <Field label="Seriennummer"><input className="inp mono" value={form.seriennummer} onChange={(e) => upd('seriennummer', e.target.value)} /></Field>
            <Field label="Standort / Raum"><input className="inp" value={form.standort} onChange={(e) => upd('standort', e.target.value)} placeholder="z. B. Raum 204" /></Field>
          </div>
          <div className="grid2">
            <Field label="Anschaffungsjahr"><input className="inp" value={form.anschaffung} onChange={(e) => upd('anschaffung', e.target.value)} placeholder="z. B. 2024" /></Field>
            <label className="check">
              <input type="checkbox" checked={form.digitalpakt} onChange={(e) => upd('digitalpakt', e.target.checked)} />
              <span>Aus DigitalPakt-Mitteln</span>
            </label>
          </div>
          <Field label="Notiz"><textarea className="inp ta" value={form.notiz} onChange={(e) => upd('notiz', e.target.value)} placeholder="Optionale Anmerkungen …" /></Field>
          {formError && <div className="err">{formError}</div>}
        </Modal>
      )}

      {modal === 'lend' && lendTarget && (
        <Modal
          title="Gerät ausleihen"
          onClose={closeModal}
          footer={
            <>
              <span className="foot-spacer" />
              <button className="btn btn-ghost" onClick={closeModal}>Abbrechen</button>
              <button className="btn btn-primary" onClick={confirmLend}>Ausleihe bestätigen</button>
            </>
          }
        >
          <div className="leih-info">Gerät <span className="mono">{lendTarget.inventarnummer}</span> · {lendTarget.modell || 'Gerät'}</div>
          <Field label="Ausgeliehen an *" hint="Datensparsamkeit: bei Schüler:innen möglichst Klasse oder Kürzel statt vollständigem Namen.">
            <input className="inp" value={lendForm.ausleiheAn} onChange={(e) => setLendForm((f) => ({ ...f, ausleiheAn: e.target.value }))} placeholder="z. B. Klasse 7b oder Hr. Wagner" />
          </Field>
          <div className="presets">
            <span className="presets-lbl">Vorlagen</span>
            <div className="chips">
              {presets.map((p) => (
                <span className="chip" key={p}>
                  <button className="chip-fill" onClick={() => setLendForm((f) => ({ ...f, ausleiheAn: p }))}>{p}</button>
                  <button className="chip-x" onClick={() => removePreset(p)} aria-label={`Vorlage ${p} entfernen`}>✕</button>
                </span>
              ))}
              {lendForm.ausleiheAn.trim() && !presets.includes(lendForm.ausleiheAn.trim()) && (
                <button className="chip-add" onClick={addPreset}>+ „{lendForm.ausleiheAn.trim()}“ merken</button>
              )}
              {presets.length === 0 && !lendForm.ausleiheAn.trim() && (
                <span className="chips-empty">Noch keine Vorlagen – einfach oben eintippen und merken.</span>
              )}
            </div>
          </div>
          <Field label="Rückgabe bis">
            <input type="date" className="inp" value={lendForm.rueckgabe} onChange={(e) => setLendForm((f) => ({ ...f, rueckgabe: e.target.value }))} />
          </Field>
          {lendError && <div className="err">{lendError}</div>}
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Gerät löschen?"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <span className="foot-spacer" />
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={doDelete}>Endgültig löschen</button>
            </>
          }
        >
          <p className="confirm-txt">Soll <span className="mono">{confirmDelete.inventarnummer}</span> ({confirmDelete.modell || 'Gerät'}) dauerhaft gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </Modal>
      )}

      {scanOpen && (
        <Modal
          title="Inventarnummer scannen"
          onClose={closeScan}
          footer={<><span className="foot-spacer" /><button className="btn btn-ghost" onClick={closeScan}>Schließen</button></>}
        >
          <p className="scan-hint">Mit einem Handscanner (Tastatur-Modus) scannen – die Nummer erscheint im Feld und wird mit Enter gesucht. Alternativ Nummer eintippen und Enter drücken, oder die Gerätekamera nutzen.</p>
          <input className="inp mono" autoFocus value={scanValue}
            onChange={(e) => { setScanValue(e.target.value); setScanMsg(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doScan(scanValue); } }}
            placeholder="z. B. IT-2024-0051" />
          <div className="scan-actions">
            <button className="btn btn-primary" onClick={() => doScan(scanValue)}>Suchen</button>
            <button className="btn btn-ghost" onClick={toggleCamera}>{camActive ? 'Kamera stoppen' : 'Kamera nutzen'}</button>
          </div>
          {camActive && <video ref={videoRef} className="scan-video" muted playsInline />}
          {camError && <div className="scan-note">{camError}</div>}
          {scanMsg && scanMsg.kind === 'notfound' && (
            <div className="scan-note">Keine Treffer für <span className="mono">{scanMsg.inv}</span>. <button className="link" onClick={() => openAddWith(scanMsg.inv)}>Als neues Gerät anlegen</button></div>
          )}
        </Modal>
      )}

      {labelsOpen && (
        <div className="labels-overlay">
          <div className="labels-bar no-print">
            <div className="labels-bar-l">
              <strong>Etiketten drucken</strong>
              <span className="labels-count">{gefiltert.length} Etikett{gefiltert.length === 1 ? '' : 'en'} · aktuelle Auswahl</span>
            </div>
            <div className="labels-bar-r">
              <input className="inp labels-school" placeholder="Schulname (optional)" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
              <div className="seg">
                <button className={`seg-btn ${codeType === 'barcode' ? 'on' : ''}`} onClick={() => setCodeType('barcode')}>Barcode</button>
                <button className={`seg-btn ${codeType === 'qr' ? 'on' : ''}`} onClick={() => setCodeType('qr')}>QR-Code</button>
              </div>
              <div className="seg">
                <button className={`seg-btn ${labelSize === 'standard' ? 'on' : ''}`} onClick={() => setLabelSize('standard')}>Standard</button>
                <button className={`seg-btn ${labelSize === 'klein' ? 'on' : ''}`} onClick={() => setLabelSize('klein')}>Klein</button>
              </div>
              <button className="btn btn-primary" onClick={() => window.print()} disabled={gefiltert.length === 0}>Drucken</button>
              <button className="btn btn-ghost" onClick={closeLabels}>Schließen</button>
            </div>
          </div>
          <div className="labels-scroll">
            <div className="labels-hint no-print">Tipp: im Hauptfenster vorher filtern (z. B. nach Raum) oder eine Inventarnummer suchen, um gezielt einzelne Etiketten zu drucken. Die Codes sind Code-128-Barcodes der Inventarnummer und lassen sich direkt mit der Scan-Funktion wieder einlesen. Über „Drucken“ kann auch „Als PDF speichern“ gewählt werden.</div>
            {gefiltert.length === 0 ? (
              <div className="noresult">Keine Geräte in der aktuellen Auswahl.</div>
            ) : (
              <div className="labels-sheet">
                {gefiltert.map((g) => (
                  <div className={`label label-${labelSize} label-mode-${codeType}`} key={g.id}>
                    {codeType === 'qr' ? (
                      <>
                        <div className="label-qr-code"><QRCode value={g.inventarnummer} /></div>
                        <div className="label-qr-info">
                          <div className="label-qr-head">
                            <span className="label-school">{schoolName || 'Schul-IT'}</span>
                            {g.typ && <span className="label-typ">{g.typ}</span>}
                          </div>
                          <div className="label-inv mono">{g.inventarnummer}</div>
                          <div className="label-sub">{[g.modell, g.standort].filter(Boolean).join(' · ')}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="label-head">
                          <span className="label-school">{schoolName || 'Schul-IT'}</span>
                          {g.typ && <span className="label-typ">{g.typ}</span>}
                        </div>
                        <div className="label-barcode"><Barcode value={g.inventarnummer} /></div>
                        <div className="label-inv mono">{g.inventarnummer}</div>
                        <div className="label-sub">{[g.modell, g.standort].filter(Boolean).join(' · ')}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showInfo && (
        <Modal title="Datenschutz &amp; Hinweise" onClose={() => setShowInfo(false)} wide
          footer={<><span className="foot-spacer" /><button className="btn btn-primary" onClick={() => setShowInfo(false)}>Schließen</button></>}
        >
          <div className="dsgvo" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="dsgvo-item">
              <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--verf)' }} />Lokale Speicherung</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--nebel)', lineHeight: 1.55, paddingLeft: '15px' }}>Alle Inventar- und Ausleihdaten werden ausschließlich lokal in diesem Browserprofil gespeichert. Es erfolgt keine Übertragung an externe Server oder Dritte.</p>
            </div>
            <div className="dsgvo-item">
              <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cobalt)' }} />Datensparsamkeit</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--nebel)', lineHeight: 1.55, paddingLeft: '15px' }}>Bei der Ausleihe – insbesondere an Schülerinnen und Schüler – möglichst nur die nötigsten Angaben erfassen, z. B. Klasse oder Kürzel statt vollständigem Namen. Personenbezogene Daten nach der Rückgabe nicht länger als nötig vorhalten (Art. 5 DSGVO: Datenminimierung &amp; Speicherbegrenzung).</p>
            </div>
            <div className="dsgvo-item">
              <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--verl)' }} />Backup, Export &amp; Import</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--nebel)', lineHeight: 1.55, paddingLeft: '15px' }}>Den Bestand regelmäßig als CSV exportieren und lokal bzw. im schulischen Netzlaufwerk sichern. Bestehende Listen lassen sich per CSV-Import (Spalte „Inventarnummer“ erforderlich) übernehmen; vorhandene Geräte werden anhand der Inventarnummer aktualisiert.</p>
            </div>
            <div className="dsgvo-item">
              <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rep)' }} />Produktivbetrieb</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--nebel)', lineHeight: 1.55, paddingLeft: '15px' }}>Für den verbindlichen Einsatz im Schulbetrieb das schulische Datenschutzkonzept beachten und im Zweifel mit der bzw. dem schulischen Datenschutzbeauftragten abstimmen. Bei zentraler Verarbeitung können landesspezifische Vorgaben (z. B. Logineo NRW, mebis) sowie Regelungen zur Auftragsverarbeitung relevant sein. Dieses Werkzeug ersetzt keine rechtliche Beratung.</p>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
