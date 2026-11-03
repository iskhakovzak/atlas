import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {precompressStatic} from '../scripts/precompress-static.mjs';
import {checkPrecompressedAssets} from '../scripts/check-vps-build.mjs';

test('hashed assets get .br and .gz beside them, no .zst, tiny files none', async () => {
  const client = mkdtempSync(path.join(tmpdir(), 'atlas-precompress-'));
  try {
    const assets = path.join(client, '_next', 'static', 'chunks');
    mkdirSync(assets, {recursive: true});
    const big = 'export const copy = ' + JSON.stringify('Atlas '.repeat(4000)) + ';\n';
    writeFileSync(path.join(assets, 'page-AbC123xy.js'), big);
    writeFileSync(path.join(assets, 'tiny-AbC123xy.js'), 'x');
    writeFileSync(path.join(assets, 'page-AbC123xy.js.zst'), 'stale');
    writeFileSync(path.join(assets, 'photo-AbC123xy.png'), Buffer.alloc(4096));
    writeFileSync(path.join(client, 'robots.txt'), 'User-agent: *\n'.repeat(200));
    const totals = await precompressStatic(client);
    assert.equal(totals.files, 2);
    const file = path.join(assets, 'page-AbC123xy.js');
    assert.equal(zlib.brotliDecompressSync(readFileSync(file + '.br')).toString(), big);
    assert.equal(zlib.gunzipSync(readFileSync(file + '.gz')).toString(), big);
    assert.ok(readFileSync(file + '.br').length < readFileSync(file + '.gz').length);
    assert.equal(existsSync(file + '.zst'), false);
    assert.equal(existsSync(path.join(assets, 'tiny-AbC123xy.js.br')), false);
    assert.equal(existsSync(path.join(assets, 'photo-AbC123xy.png.br')), false);
    // Public files outside the hashed directory may change between deploys: compressed on the fly, not here.
    assert.equal(existsSync(path.join(client, 'robots.txt.br')), false);
    assert.equal(checkPrecompressedAssets(client), 2);
    rmSync(file + '.br');
    assert.throws(() => checkPrecompressedAssets(client), /without \.br/);
  } finally {
    rmSync(client, {recursive: true, force: true});
  }
});
