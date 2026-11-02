import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collect, render} from '../scripts/third-party-notices.mjs';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the notices list every shipped package with a licence, Tesseract’s attribution and no build-only tooling', () => {
  const packages = collect();
  const names = new Set(packages.map((item) => item.name));
  for (const name of ['react', 'react-dom', 'zod', 'tesseract.js', 'tesseract.js-core', '@fontsource-variable/inter', 'lucide-react', 'vinext']) assert.ok(names.has(name), name);
  for (const name of ['eslint', 'typescript', 'wrangler', 'vite', 'drizzle-kit']) assert.equal(names.has(name), false, `${name} does not ship`);
  assert.deepEqual(packages.filter((item) => item.license === 'UNKNOWN').map((item) => item.name), []);
  const text = render(packages, new Date(Date.UTC(2026, 10, 3)));
  assert.match(text, /^Atlas — third-party software notices\nGenerated 2026-11-03/);
  assert.match(text, /NOTICE: Tesseract OCR/);
  assert.match(text, /Apache License, Version 2\.0/);
  assert.match(text, /\n- react \d+\.\d+\.\d+ — MIT/);
  assert.match(text, /--- LICENSE[^\n]* ---\nMIT License/);
});

test('the file is built before dev and build, not committed, and linked from the footer and /legal', () => {
  assert.match(source('scripts/run-framework.mjs'), /writeThirdPartyNotices\(\)/);
  assert.match(source('.gitignore'), /^\/public\/third-party-notices\.txt$/m);
  assert.match(source('app/site-footer.tsx'), /<a href="\/third-party-notices\.txt">\{c\.footer\.licenses\}<\/a>/);
  assert.match(source('app/legal-documents.tsx'), /<a href="\/third-party-notices\.txt">\{t\.licensesLink\}<\/a>/);
});
