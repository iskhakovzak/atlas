// The wordmark font (14.10.2026): app/fonts/manrope-atlas.woff2 is Manrope cut to "Aatls " by scripts/wordmark-font.mjs,
// declared in app/fonts/manrope.css (the fontsource faces, the Latin one without those letters) and preloaded by the layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readWoff2, readCmap, wordmarkFont, sourceFile, targetFile, WORDMARK_TEXT, WORDMARK_RANGE, rangeWithout, manropeCss, fontsourceCss } from '../scripts/wordmark-font.mjs';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');
const codes = [...WORDMARK_TEXT].map((ch) => ch.codePointAt(0));

test('the subset keeps the glyphs, kerning and axes of "atlas" and nothing else', () => {
  const full = readWoff2(readFileSync(sourceFile));
  const cut = readWoff2(readFileSync(targetFile));
  assert.ok(readFileSync(targetFile).length < 8000, 'the preloaded file stays small');
  assert.deepEqual(cut.order, full.order, 'same tables (GPOS, GSUB, HVAR, fvar, gvar… are kept)');
  assert.equal(cut.numGlyphs, full.numGlyphs, 'glyph ids are kept, so GPOS/GSUB/hmtx stay valid as they are');
  for (const tag of ['GPOS', 'GSUB', 'GDEF', 'HVAR', 'fvar', 'hmtx', 'hhea', 'OS/2', 'name']) assert.ok(cut.tables.get(tag).data.equals(full.tables.get(tag).data), tag + ' unchanged');
  const fullMap = readCmap(full.tables.get('cmap').data), cutMap = readCmap(cut.tables.get('cmap').data);
  assert.deepEqual([...cutMap.keys()].sort((a, b) => a - b), [...codes].sort((a, b) => a - b));
  const kept = new Set([0, ...codes.map((c) => fullMap.get(c))]);
  for (const c of codes) assert.equal(cutMap.get(c), fullMap.get(c));
  for (let g = 0; g < full.numGlyphs; g++) {
    // the subset stores glyf untransformed, so a record may carry up to 3 bytes of padding after it
    if (kept.has(g)) assert.ok(cut.glyphs[g].subarray(0, full.glyphs[g].length).equals(full.glyphs[g]) && cut.glyphs[g].length - full.glyphs[g].length < 4, 'outline of glyph ' + g);
    else if (!full.glyphs[g].length || full.glyphs[g].readInt16BE(0) !== -1) assert.equal(cut.glyphs[g].length, 0, 'glyph ' + g + ' is emptied');
  }
});

test('the committed subset matches the installed Manrope (node scripts/wordmark-font.mjs regenerates it)', () => {
  const fresh = readWoff2(wordmarkFont()), committed = readWoff2(readFileSync(targetFile));
  for (const tag of fresh.order) assert.ok(committed.tables.get(tag).data.equals(fresh.tables.get(tag).data), tag);
});

test('rangeWithout cuts code points out of a unicode-range', () => {
  assert.equal(rangeWithout('U+0000-00FF,U+0131', [0x20]), 'U+0000-001F,U+0021-00FF,U+0131');
  assert.equal(rangeWithout('U+0020-0022', [0x20, 0x22]), 'U+0021');
  assert.equal(rangeWithout('U+0041,U+2000-206F', [0x41, 0x61]), 'U+2000-206F');
  assert.equal(rangeWithout('U+0060-0062', [0x61]), 'U+0060,U+0062');
});

test('app/fonts/manrope.css: the fontsource faces, the Latin one without the wordmark letters, then the subset', () => {
  const css = source('app/fonts/manrope.css');
  assert.equal(css, manropeCss(), 'matches the installed fontsource (node scripts/wordmark-font.mjs regenerates it)');
  const fontsource = readFileSync(fontsourceCss, 'utf8').replace(/\r\n/g, '\n');
  const faces = (text) => [...text.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => ({
    src: m[1].match(/src: url\(([^)]+)\)/)[1].split('/').pop(), range: m[1].match(/unicode-range: ([^;]+);/)[1],
    rest: m[1].replace(/\s*(src|unicode-range):[^;]+;/g, ''),
  }));
  const ours = faces(css), theirs = faces(fontsource);
  assert.equal(ours.length, theirs.length + 1);
  assert.deepEqual(ours.slice(0, -1).map((f) => [f.src, f.rest]), theirs.map((f) => [f.src, f.rest]), 'same files, family, weights and display');
  for (const [i, face] of theirs.entries()) {
    if (face.src !== 'manrope-latin-wght-normal.woff2') assert.equal(ours[i].range, face.range, face.src);
    else assert.equal(ours[i].range, rangeWithout(face.range, codes), 'the Latin face leaves out the wordmark letters');
  }
  // No other face covers a wordmark letter, so the browser fetches only the subset for "atlas".
  const covers = (range, code) => range.split(',').some((part) => { const [a, b = a] = part.replace(/U\+/g, '').split('-').map((x) => parseInt(x, 16)); return code >= a && code <= b; });
  for (const code of codes) assert.deepEqual(ours.filter((f) => covers(f.range, code)).map((f) => f.src), ['manrope-atlas.woff2'], 'U+' + code.toString(16));
  const last = ours.at(-1);
  assert.equal(last.range, WORDMARK_RANGE);
  assert.equal(WORDMARK_RANGE, [...codes].sort((a, b) => a - b).map((c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0')).join(','));
  assert.match(css, /src: url\(\.\/manrope-atlas\.woff2\) format\('woff2-variations'\);/);
});

test('the layout imports app/fonts/manrope.css instead of the fontsource file and preloads only the subset', () => {
  const layout = source('app/layout.tsx');
  assert.doesNotMatch(layout, /@fontsource-variable\/manrope\/wght\.css/);
  assert.ok(layout.indexOf('import "./fonts/manrope.css";') > layout.indexOf('import "@fontsource-variable/inter/opsz.css";'));
  assert.ok(layout.indexOf('import "./fonts/manrope.css";') < layout.indexOf('import "./globals.css";'), 'in the place the fontsource import had');
  assert.match(layout, /import manropeWordmark from "\.\/fonts\/manrope-atlas\.woff2\?url";/);
  assert.match(layout, /preload\(manropeWordmark, font\)/);
  assert.doesNotMatch(layout, /manrope-latin-wght-normal/, 'the 24.8 KB Latin file is no longer preloaded');
});

test('Manrope draws only letters the subset has', () => {
  const allowed = new Set([...WORDMARK_TEXT]);
  const texts = [];
  for (const file of readdirSync(new URL('app/', root)).filter((f) => f.endsWith('.tsx'))) {
    for (const m of source('app/' + file).matchAll(/className="wordmark"[^>]*>([^<{]*)/g)) texts.push([file, m[1]]);
  }
  texts.push(['app/ambient.css', source('app/ambient.css').match(/\.ambient-mark::before\s*\{\s*content:\s*"([^"]*)"/)[1]]);
  assert.ok(texts.length >= 4, 'header, footer, sign-in return and invoice wordmarks found');
  for (const [file, text] of texts) for (const ch of text) assert.ok(allowed.has(ch), `${file}: "${ch}" in the wordmark is not in app/fonts/manrope-atlas.woff2 (add it to WORDMARK_TEXT in scripts/wordmark-font.mjs)`);
  // Manrope is used only through these elements (the layout CSS and the files split out of it).
  const cssFiles = [...readdirSync(new URL('app/', root)).filter((f) => f.endsWith('.css')).map((f) => 'app/' + f),
    ...readdirSync(new URL('app/styles/', root)).filter((f) => f.endsWith('.css')).map((f) => 'app/styles/' + f)];
  for (const file of cssFiles) {
    for (const m of source(file).matchAll(/([^{}]*)\{[^}]*Manrope[^}]*\}/g)) assert.match(m[1], /wordmark|ambient-mark/, file + ': Manrope on ' + m[1].trim());
  }
});
