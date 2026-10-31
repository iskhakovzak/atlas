import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openAtlasDatabase,openAtlasBucket} from '../scripts/vps-bindings.mjs';
import {checkVpsPageChunks} from '../scripts/check-vps-build.mjs';

test('VPS release check rejects the observed Linux homepage/app chunk collision',()=>{
 const build=(home,app)=>`a=()=>import(\`./${home}.js\`);b=()=>import(\`./${app}.js\`);[{pattern:\`/\`,patternParts:[],__loadPage:a},{pattern:\`/app\`,patternParts:['app'],__loadPage:b}]`;
 assert.throws(()=>checkVpsPageChunks(build('page-same','page-same')),/collision/);
 assert.doesNotThrow(()=>checkVpsPageChunks(build('page-home','page-app')));
 assert.throws(()=>checkVpsPageChunks('invalid build metadata'),/Cannot verify/);
});

test('VPS D1 adapter preserves RETURNING, changes() and atomic rollback used by Atlas CAS writes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-vps-db-'));
 const db=openAtlasDatabase(path.join(root,'atlas.sqlite'));
 try {
  db.exec('CREATE TABLE state (id TEXT PRIMARY KEY, revision INTEGER NOT NULL); CREATE TABLE audit (value TEXT);');
  assert.deepEqual(await db.prepare('INSERT INTO state VALUES (?,?) RETURNING revision').bind('one',1).first(),{revision:1});
  const result=await db.batch([
   db.prepare('UPDATE state SET revision=2 WHERE id=? AND revision=1').bind('one'),
   db.prepare("INSERT INTO audit SELECT 'won' WHERE changes()=1"),
  ]);
  assert.equal(result[0].meta.changes,1);
  await assert.rejects(db.batch([db.prepare('UPDATE state SET revision=3'),db.prepare('INSERT INTO state VALUES (?,?)').bind('one',99)]));
  assert.equal(await db.prepare('SELECT revision FROM state WHERE id=?').bind('one').first('revision'),2);
  assert.deepEqual((await db.prepare('SELECT * FROM audit').all()).results,[{value:'won'}]);
 } finally {db.close();await rm(root,{recursive:true,force:true});}
});

test('VPS private bucket round trips binary documents and treats path-like keys as opaque',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-vps-files-'));
 try {
  const bucket=openAtlasBucket(root),bytes=new Uint8Array([0,255,1,250]);
  await bucket.put('../../outside',bytes,{httpMetadata:{contentType:'application/pdf'}});
  const file=await bucket.get('../../outside');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes);
  assert.equal(file.httpMetadata.contentType,'application/pdf');
  assert.deepEqual(new Uint8Array(await new Response(file.body).arrayBuffer()),bytes);
  await bucket.delete(['../../outside']);
  assert.equal(await bucket.get('../../outside'),null);
 } finally {await rm(root,{recursive:true,force:true});}
});
