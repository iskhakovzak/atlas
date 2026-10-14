// The wordmark font (14.10.2026): Manrope draws only the word "atlas"/"Atlas" (the header and footer wordmark, the
// watermarks of app/ambient.css, the invoice heading), yet every page preloaded its whole Latin file (24.8 KB). This
// script cuts that file down to the glyphs of "Aatls " and writes app/fonts/manrope-atlas.woff2 (≈6 KB), which
// app/layout.tsx preloads instead. It also writes app/fonts/manrope.css, imported by the layout in place of
// @fontsource-variable/manrope/wght.css: the same faces and files, except that the Latin face leaves out the characters of
// the subset, which a face of their own (the last one) declares. With unicode-range faces the browser fetches every face
// that covers a character until one is ready, so a Latin face that still covered "atlas" was fetched (24.8 KB) next to the
// subset on every page.
//   node scripts/wordmark-font.mjs            regenerate both files after a Manrope update
//   node scripts/wordmark-font.mjs --check    exit 1 when the committed files no longer match the installed Manrope
// No dependencies: WOFF2 is decoded here (brotli from node:zlib, the glyf/loca transform of the WOFF2 spec) and
// written again with untransformed glyf/loca. Every glyph id is kept, so GSUB, GPOS (kerning), HVAR and hmtx stay
// valid as they are; glyphs outside the set lose their outline and their variation data. cmap is rebuilt for the kept
// characters only and post drops glyph names (format 3). The axes (fvar, gvar for the kept glyphs) stay, so every
// weight from 200 to 800 renders exactly as with the full file.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

export const WORDMARK_TEXT = "Aatls ";
export const WORDMARK_RANGE = "U+0020,U+0041,U+0061,U+006C,U+0073,U+0074";

const KNOWN_TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

const u16 = (b, i) => b.readUInt16BE(i);
const i16 = (b, i) => b.readInt16BE(i);
const u32 = (b, i) => b.readUInt32BE(i);

/** Decodes a WOFF2 file into its sfnt tables; `glyphs` holds each glyph as a plain TrueType glyf record. */
export function readWoff2(file) {
  if (file.toString("latin1", 0, 4) !== "wOF2") throw Error("not a WOFF2 file");
  const count = u16(file, 12);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = file[at++];
      if (i === 0 && byte === 0x80) throw Error("bad UIntBase128");
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw Error("bad UIntBase128");
  };
  const entries = [];
  for (let i = 0; i < count; i++) {
    const flags = file[at++];
    let tag = KNOWN_TAGS[flags & 63];
    if ((flags & 63) === 63) { tag = file.toString("latin1", at, at + 4); at += 4; }
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    entries.push({ tag, transformed, length: transformed ? base128() : origLength });
  }
  const stream = zlib.brotliDecompressSync(file.subarray(at, at + u32(file, 20)));
  let offset = 0;
  const tables = new Map();
  for (const entry of entries) { tables.set(entry.tag, { ...entry, data: stream.subarray(offset, offset + entry.length) }); offset += entry.length; }
  const numGlyphs = u16(tables.get("maxp").data, 4);
  const longLoca = i16(tables.get("head").data, 50) === 1;
  const glyf = tables.get("glyf");
  const glyphs = glyf.transformed ? untransformGlyf(glyf.data, numGlyphs) : splitGlyf(glyf.data, tables.get("loca").data, numGlyphs, longLoca);
  return { flavor: u32(file, 4), version: [u16(file, 24), u16(file, 26)], order: entries.map((e) => e.tag), tables, numGlyphs, longLoca, glyphs };
}

function splitGlyf(glyf, loca, numGlyphs, longLoca) {
  const at = (g) => (longLoca ? u32(loca, g * 4) : u16(loca, g * 2) * 2);
  return Array.from({ length: numGlyphs }, (_, g) => Buffer.from(glyf.subarray(at(g), at(g + 1))));
}

// 255UInt16 of the WOFF2 spec
function read255(b, cursor) {
  const code = b[cursor.i++];
  if (code === 253) { const value = u16(b, cursor.i); cursor.i += 2; return value; }
  if (code === 255) return b[cursor.i++] + 253;
  if (code === 254) return b[cursor.i++] + 506;
  return code;
}

/** The transformed glyf table (WOFF2 spec, 5.1) back to TrueType glyph records. */
function untransformGlyf(b, numGlyphs) {
  const optionFlags = u16(b, 2);
  if (u16(b, 4) !== numGlyphs) throw Error("glyf and maxp disagree on the glyph count");
  const streams = [];
  let at = 36;
  for (let i = 0; i < 7; i++) { const size = u32(b, 8 + i * 4); streams.push(b.subarray(at, at + size)); at += size; }
  const [contours, points, flags, data, composites, boxes, instructions] = streams;
  const overlap = optionFlags & 1 ? b.subarray(at, at + ((numGlyphs + 7) >> 3)) : null;
  const boxBitmap = 4 * ((numGlyphs + 31) >> 5);
  const pos = { points: { i: 0 }, flag: 0, data: { i: 0 }, composite: 0, box: boxBitmap, instruction: 0 };
  const readBox = () => { const box = [0, 2, 4, 6].map((k) => i16(boxes, pos.box + k)); pos.box += 8; return box; };
  const takeInstructions = (length) => { const out = instructions.subarray(pos.instruction, pos.instruction + length); pos.instruction += length; return out; };
  const glyphs = [];
  for (let g = 0; g < numGlyphs; g++) {
    const contourCount = i16(contours, g * 2);
    const hasBox = boxes[g >> 3] & (0x80 >> (g & 7));
    if (contourCount === 0) { glyphs.push(Buffer.alloc(0)); continue; }
    if (contourCount === -1) {
      const box = readBox();
      const start = pos.composite;
      let more = true, withInstructions = false;
      while (more) {
        const flag = u16(composites, pos.composite);
        more = !!(flag & 0x20);
        withInstructions ||= !!(flag & 0x100);
        pos.composite += componentLength(flag);
      }
      const head = Buffer.alloc(10);
      head.writeInt16BE(-1, 0);
      box.forEach((v, i) => head.writeInt16BE(v, 2 + i * 2));
      const parts = [head, composites.subarray(start, pos.composite)];
      if (withInstructions) {
        const code = takeInstructions(read255(data, pos.data));
        const length = Buffer.alloc(2);
        length.writeUInt16BE(code.length);
        parts.push(length, code);
      }
      glyphs.push(Buffer.concat(parts));
      continue;
    }
    const ends = [];
    let total = 0;
    for (let c = 0; c < contourCount; c++) { total += read255(points, pos.points); ends.push(total - 1); }
    const coords = [];
    let x = 0, y = 0;
    for (let i = 0; i < total; i++) {
      const raw = flags[pos.flag++];
      const [dx, dy, size] = triplet(raw & 0x7f, data, pos.data.i);
      pos.data.i += size;
      x += dx; y += dy;
      coords.push([x, y, !(raw >> 7)]);
    }
    const code = takeInstructions(read255(data, pos.data));
    const box = hasBox ? readBox() : [Math.min(...coords.map((p) => p[0])), Math.min(...coords.map((p) => p[1])), Math.max(...coords.map((p) => p[0])), Math.max(...coords.map((p) => p[1]))];
    glyphs.push(simpleGlyph(ends, coords, code, box, !!(overlap && overlap[g >> 3] & (0x80 >> (g & 7)))));
  }
  return glyphs;
}

const componentLength = (flag) => 4 + (flag & 1 ? 4 : 2) + (flag & 8 ? 2 : flag & 0x40 ? 4 : flag & 0x80 ? 8 : 0);

/** One point of the triplet encoding (WOFF2 spec, 5.2): [dx, dy, bytes read]. */
function triplet(flag, d, at) {
  const signed = (bit, value) => (bit & 1 ? value : -value);
  if (flag < 10) return [0, signed(flag, ((flag & 14) << 7) + d[at]), 1];
  if (flag < 20) return [signed(flag, (((flag - 10) & 14) << 7) + d[at]), 0, 1];
  if (flag < 84) { const b0 = flag - 20, b1 = d[at]; return [signed(flag, 1 + (b0 & 0x30) + (b1 >> 4)), signed(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f)), 1]; }
  if (flag < 120) { const b0 = flag - 84; return [signed(flag, 1 + (Math.floor(b0 / 12) << 8) + d[at]), signed(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + d[at + 1]), 2]; }
  if (flag < 124) { const b2 = d[at + 1]; return [signed(flag, (d[at] << 4) + (b2 >> 4)), signed(flag >> 1, ((b2 & 0x0f) << 8) + d[at + 2]), 3]; }
  return [signed(flag, (d[at] << 8) + d[at + 1]), signed(flag >> 1, (d[at + 2] << 8) + d[at + 3]), 4];
}

function simpleGlyph(ends, coords, code, box, overlap) {
  const flags = [], xs = [], ys = [];
  let px = 0, py = 0;
  coords.forEach(([x, y, on], i) => {
    let flag = on ? 1 : 0;
    const dx = x - px, dy = y - py;
    px = x; py = y;
    if (dx === 0) flag |= 0x10; else if (Math.abs(dx) < 256) { flag |= 0x02 | (dx > 0 ? 0x10 : 0); xs.push([1, Math.abs(dx)]); } else xs.push([2, dx]);
    if (dy === 0) flag |= 0x20; else if (Math.abs(dy) < 256) { flag |= 0x04 | (dy > 0 ? 0x20 : 0); ys.push([1, Math.abs(dy)]); } else ys.push([2, dy]);
    if (i === 0 && overlap) flag |= 0x40;
    flags.push(flag);
  });
  const head = Buffer.alloc(12 + ends.length * 2);
  head.writeInt16BE(ends.length, 0);
  box.forEach((v, i) => head.writeInt16BE(v, 2 + i * 2));
  ends.forEach((v, i) => head.writeUInt16BE(v, 10 + i * 2));
  head.writeUInt16BE(code.length, 10 + ends.length * 2);
  const deltas = [...xs, ...ys].map(([size, v]) => { const b = Buffer.alloc(size); if (size === 1) b.writeUInt8(v); else b.writeInt16BE(v); return b; });
  return Buffer.concat([head, Buffer.from(code), Buffer.from(flags), ...deltas]);
}

/** The Unicode → glyph map of a cmap table (format 4 or 12 subtable for Unicode). */
export function readCmap(cmap) {
  let best = null;
  for (let i = 0; i < u16(cmap, 2); i++) {
    const platform = u16(cmap, 4 + i * 8), encoding = u16(cmap, 6 + i * 8), offset = u32(cmap, 8 + i * 8);
    const format = u16(cmap, offset);
    if ((platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0) if (!best || format === 12) best = { offset, format };
  }
  if (!best) throw Error("no Unicode cmap");
  const map = new Map(), { offset } = best;
  if (best.format === 4) {
    const segX2 = u16(cmap, offset + 6), ends = offset + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = u16(cmap, ends + s * 2), start = u16(cmap, starts + s * 2), delta = i16(cmap, deltas + s * 2), range = u16(cmap, ranges + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let glyph = range === 0 ? (c + delta) & 0xffff : u16(cmap, ranges + s * 2 + range + (c - start) * 2);
        if (range !== 0 && glyph) glyph = (glyph + delta) & 0xffff;
        if (glyph) map.set(c, glyph);
      }
    }
  } else if (best.format === 12) {
    for (let i = 0; i < u32(cmap, offset + 12); i++) {
      const start = u32(cmap, offset + 16 + i * 12), end = u32(cmap, offset + 20 + i * 12), first = u32(cmap, offset + 24 + i * 12);
      for (let c = start; c <= end; c++) map.set(c, first + c - start);
    }
  } else throw Error("cmap format " + best.format);
  return map;
}

/** A cmap with one format 4 subtable (Unicode BMP and Windows BMP records): one segment per character. */
function writeCmap(pairs) {
  const segments = [...pairs].sort((a, b) => a[0] - b[0]).map(([c, glyph]) => ({ start: c, end: c, delta: (glyph - c) & 0xffff }));
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const segX2 = segments.length * 2, selector = Math.floor(Math.log2(segments.length)), searchRange = 2 * 2 ** selector;
  const table = Buffer.alloc(16 + segX2 * 4);
  [4, table.length, 0, segX2, searchRange, selector, segX2 - searchRange].forEach((v, i) => table.writeUInt16BE(v, i * 2));
  segments.forEach((s, i) => {
    table.writeUInt16BE(s.end, 14 + i * 2);
    table.writeUInt16BE(s.start, 16 + segX2 + i * 2);
    table.writeUInt16BE(s.delta, 16 + segX2 * 2 + i * 2);
  });
  const head = Buffer.alloc(20);
  [0, 2, 0, 3].forEach((v, i) => head.writeUInt16BE(v, i * 2));
  head.writeUInt32BE(20, 8);
  head.writeUInt16BE(3, 12); head.writeUInt16BE(1, 14); head.writeUInt32BE(20, 16);
  return Buffer.concat([head, table]);
}

/** gvar with the variation data of the kept glyphs only (offsets, shared tuples and flags otherwise as they were). */
function subsetGvar(b, numGlyphs, kept) {
  const axes = u16(b, 4), sharedCount = u16(b, 6), sharedOffset = u32(b, 8), count = u16(b, 12), long = u16(b, 14) & 1, dataOffset = u32(b, 16);
  if (count !== numGlyphs) throw Error("gvar and maxp disagree on the glyph count");
  const at = (g) => (long ? u32(b, 20 + g * 4) : u16(b, 20 + g * 2) * 2);
  const shared = b.subarray(sharedOffset, sharedOffset + sharedCount * axes * 2);
  const blocks = Array.from({ length: count }, (_, g) => (kept(g) ? b.subarray(dataOffset + at(g), dataOffset + at(g + 1)) : Buffer.alloc(0)));
  const offsets = [0];
  for (const block of blocks) offsets.push(offsets.at(-1) + block.length + (long ? 0 : block.length % 2));
  const sharedAt = 20 + (count + 1) * (long ? 4 : 2);
  const dataAt = sharedAt + shared.length + ((sharedAt + shared.length) % 2);
  const out = Buffer.alloc(dataAt + offsets.at(-1));
  b.copy(out, 0, 0, 20);
  out.writeUInt32BE(sharedAt, 8);
  out.writeUInt32BE(dataAt, 16);
  offsets.forEach((v, i) => (long ? out.writeUInt32BE(v, 20 + i * 4) : out.writeUInt16BE(v / 2, 20 + i * 2)));
  shared.copy(out, sharedAt);
  blocks.forEach((block, g) => block.copy(out, dataAt + offsets[g]));
  return out;
}

/** The subset font as sfnt tables, in the source order. */
export function subsetTables(font, text) {
  const cmap = readCmap(font.tables.get("cmap").data);
  const chars = [...new Set([...text].map((ch) => ch.codePointAt(0)))];
  const keep = new Set([0]);
  for (const c of chars) {
    if (!cmap.has(c)) throw Error("the font has no glyph for U+" + c.toString(16).toUpperCase().padStart(4, "0"));
    keep.add(cmap.get(c));
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const g of [...keep]) {
      const glyph = font.glyphs[g];
      if (!glyph.length || i16(glyph, 0) !== -1) continue;
      for (let at = 10, more = true; more;) {
        const flag = u16(glyph, at), component = u16(glyph, at + 2);
        if (!keep.has(component)) { keep.add(component); grew = true; }
        more = !!(flag & 0x20);
        at += componentLength(flag);
      }
    }
  }
  const parts = [], offsets = [0];
  for (let g = 0; g < font.numGlyphs; g++) {
    const glyph = keep.has(g) ? font.glyphs[g] : Buffer.alloc(0);
    const pad = font.longLoca ? (4 - (glyph.length % 4)) % 4 : glyph.length % 2;
    parts.push(glyph, Buffer.alloc(pad));
    offsets.push(offsets.at(-1) + glyph.length + pad);
  }
  const loca = Buffer.alloc(offsets.length * (font.longLoca ? 4 : 2));
  offsets.forEach((v, i) => (font.longLoca ? loca.writeUInt32BE(v, i * 4) : loca.writeUInt16BE(v / 2, i * 2)));
  const post = Buffer.from(font.tables.get("post").data.subarray(0, 32));
  post.writeUInt32BE(0x00030000, 0);
  const head = Buffer.from(font.tables.get("head").data);
  head.writeUInt32BE(0, 8); // checkSumAdjustment: a WOFF2 decoder computes it
  const replaced = {
    glyf: Buffer.concat(parts),
    loca,
    gvar: font.tables.has("gvar") ? subsetGvar(font.tables.get("gvar").data, font.numGlyphs, (g) => keep.has(g)) : undefined,
    cmap: writeCmap(chars.map((c) => [c, cmap.get(c)])),
    post,
    head,
  };
  return { glyphs: [...keep].sort((a, b) => a - b), tables: font.order.map((tag) => ({ tag, data: replaced[tag] ?? Buffer.from(font.tables.get(tag).data) })) };
}

/** WOFF2 with null-transformed glyf/loca (WOFF2 spec, 5.3). */
export function writeWoff2(tables, { flavor, version }) {
  const base128 = (value) => { const bytes = []; do { bytes.unshift(value & 0x7f); value = Math.floor(value / 128); } while (value > 0); return Buffer.from(bytes.map((b, i) => (i < bytes.length - 1 ? b | 0x80 : b))); };
  const directory = Buffer.concat(tables.flatMap(({ tag, data }) => {
    const known = KNOWN_TAGS.indexOf(tag);
    const nullTransform = tag === "glyf" || tag === "loca" ? 3 : 0;
    return [Buffer.from([(nullTransform << 6) | (known >= 0 ? known : 63)]), ...(known >= 0 ? [] : [Buffer.from(tag, "latin1")]), base128(data.length)];
  }));
  const compressed = zlib.brotliCompressSync(Buffer.concat(tables.map((t) => t.data)), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT } });
  const unpadded = 48 + directory.length + compressed.length, length = (unpadded + 3) & ~3;
  const header = Buffer.alloc(48);
  header.write("wOF2", 0, "latin1");
  header.writeUInt32BE(flavor, 4);
  header.writeUInt32BE(length, 8);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(12 + 16 * tables.length + tables.reduce((sum, t) => sum + ((t.data.length + 3) & ~3), 0), 16);
  header.writeUInt32BE(compressed.length, 20);
  header.writeUInt16BE(version[0], 24);
  header.writeUInt16BE(version[1], 26);
  return Buffer.concat([header, directory, compressed, Buffer.alloc(length - unpadded)]);
}

export const sourceFile = fileURLToPath(new URL("../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", import.meta.url));
export const targetFile = fileURLToPath(new URL("../app/fonts/manrope-atlas.woff2", import.meta.url));

export function wordmarkFont(source = readFileSync(sourceFile)) {
  const font = readWoff2(source);
  return writeWoff2(subsetTables(font, WORDMARK_TEXT).tables, font);
}

export const fontsourceCss = fileURLToPath(new URL("../node_modules/@fontsource-variable/manrope/wght.css", import.meta.url));
export const cssFile = fileURLToPath(new URL("../app/fonts/manrope.css", import.meta.url));

const hex = (code) => code.toString(16).toUpperCase().padStart(4, "0");
/** A unicode-range without some code points: ("U+0000-00FF,U+0131", [0x20]) → "U+0000-001F,U+0021-00FF,U+0131". */
export function rangeWithout(range, codes) {
  const out = [];
  for (const part of range.split(",").map((item) => item.trim())) {
    const match = part.match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i);
    if (!match) throw Error("unexpected unicode-range part: " + part);
    let from = parseInt(match[1], 16);
    const to = parseInt(match[2] ?? match[1], 16);
    for (const code of [...codes].filter((c) => c >= from && c <= to).sort((a, b) => a - b)) {
      if (code > from) out.push([from, code - 1]);
      from = code + 1;
    }
    if (from <= to) out.push([from, to]);
  }
  return out.map(([a, b]) => "U+" + hex(a) + (a === b ? "" : "-" + hex(b))).join(",");
}

const cssHeader = `/* Generated by scripts/wordmark-font.mjs from @fontsource-variable/manrope/wght.css: do not edit, run the script.
   Manrope draws only the wordmark ("atlas"/"Atlas"). The fontsource faces below are as published, except that the Latin
   face leaves out ${WORDMARK_RANGE}: those come from the last face, manrope-atlas.woff2 (the same glyphs,
   kerning and weight axis cut to these letters), which app/layout.tsx preloads. A Latin face that still covered them was
   fetched next to it on every page, since the browser loads each face that covers a character until one is ready. */
`;
const subsetFace = `
/* manrope-atlas (the wordmark) */
@font-face {
  font-family: 'Manrope Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 200 800;
  src: url(./manrope-atlas.woff2) format('woff2-variations');
  unicode-range: ${WORDMARK_RANGE};
}
`;

/** app/fonts/manrope.css for the installed @fontsource-variable/manrope. */
export function manropeCss(source = readFileSync(fontsourceCss, "utf8")) {
  const codes = [...new Set([...WORDMARK_TEXT].map((ch) => ch.codePointAt(0)))];
  let latin = 0;
  const faces = source.replace(/\r\n/g, "\n")
    .replace(/url\(\.\/files\//g, "url(../../node_modules/@fontsource-variable/manrope/files/")
    .replace(/(manrope-latin-wght-normal\.woff2\) format\('woff2-variations'\);\n\s*unicode-range: )([^;]+);/, (_, head, range) => { latin++; return head + rangeWithout(range, codes) + ";"; });
  if (latin !== 1) throw Error("the Latin face of @fontsource-variable/manrope/wght.css was not found");
  return cssHeader + faces.trim() + "\n" + subsetFace;
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const fresh = readWoff2(wordmarkFont());
  if (process.argv.includes("--check")) {
    const committed = readWoff2(readFileSync(targetFile));
    const same = committed.order.join() === fresh.order.join() && fresh.order.every((tag) => committed.tables.get(tag).data.equals(fresh.tables.get(tag).data));
    const sameCss = readFileSync(cssFile, "utf8").replace(/\r\n/g, "\n") === manropeCss();
    console.log(same ? "app/fonts/manrope-atlas.woff2 matches the installed Manrope" : "app/fonts/manrope-atlas.woff2 is out of date: run node scripts/wordmark-font.mjs");
    console.log(sameCss ? "app/fonts/manrope.css matches the installed Manrope" : "app/fonts/manrope.css is out of date: run node scripts/wordmark-font.mjs");
    process.exitCode = same && sameCss ? 0 : 1;
  } else {
    const file = wordmarkFont();
    writeFileSync(targetFile, file);
    writeFileSync(cssFile, manropeCss());
    console.log(`app/fonts/manrope-atlas.woff2: ${file.length} bytes (from ${readFileSync(sourceFile).length}); app/fonts/manrope.css written`);
  }
}
