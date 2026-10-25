import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {encodeCatalogStorage,decodeCatalogStorage,catalogStoredByteLimit,catalogDecodedByteLimit,CatalogCapacityError} from '../lib/market/catalog-storage.ts';
import {catalogDocumentSchema,catalogMaxEntries,initialCatalog} from '../lib/market/catalog-editor.ts';

test('large variant snapshots survive compressed SQLite storage and optimistic updates without losing data',async()=>{
  const document={revision:4,entries:Array.from({length:110},(_,i)=>({id:`item-${i}`,draft:{name:'Цвет и размер',variants:Array.from({length:100},(_,v)=>({id:`${i}-${v}`,size:String(v),available:v%2===0,price:10+v,image:`https://example.com/photos/${i}/a-long-colour-specific-image-path-${v}.jpg`}))},published:{description:'Complete published snapshot '.repeat(80)}}))};
  assert.ok(Buffer.byteLength(JSON.stringify(document))>1_500_000);
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE catalog(value TEXT)');
  try{
    const encoded=await encodeCatalogStorage(document);assert.ok(Buffer.byteLength(encoded)<catalogStoredByteLimit);
    db.prepare('INSERT INTO catalog VALUES (?)').run(encoded);
    assert.deepEqual(await decodeCatalogStorage(db.prepare('SELECT value FROM catalog').get().value),document);
    const next=await encodeCatalogStorage({...document,revision:5});
    assert.equal(db.prepare('UPDATE catalog SET value=? WHERE value=?').run(next,encoded).changes,1);
    assert.equal(db.prepare('UPDATE catalog SET value=? WHERE value=?').run(encoded,encoded).changes,0,'stale writers cannot overwrite');
    assert.equal((await decodeCatalogStorage(db.prepare('SELECT value FROM catalog').get().value)).revision,5);
  }finally{db.close();}
});
test('legacy JSON including multibyte text and large preexisting rows remains readable',async()=>{
  const old={revision:1,entries:[],label:'Ўзбекча · размер · 💚'};
  assert.equal(await encodeCatalogStorage(old),JSON.stringify(old));
  assert.deepEqual(await decodeCatalogStorage(JSON.stringify(old)),old);
  const large={text:'я'.repeat(800000)};
  assert.deepEqual(await decodeCatalogStorage(JSON.stringify(large)),large);
  assert.deepEqual(await decodeCatalogStorage(await encodeCatalogStorage(large)),large);
});
test('invalid or oversized storage is rejected rather than reset or truncated',async()=>{
  await assert.rejects(decodeCatalogStorage('atlas.catalog.gzip.v1:bad!'));
  await assert.rejects(encodeCatalogStorage({text:'x'.repeat(catalogDecodedByteLimit)}),CatalogCapacityError);
  await assert.rejects(encodeCatalogStorage({text:randomBytes(1_500_000).toString('hex')}),CatalogCapacityError,'incompressible data still respects the stored row budget');
  const bomb=Buffer.from(await new Response(new Blob(['x'.repeat(catalogDecodedByteLimit+1)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).toString('base64');
  await assert.rejects(decodeCatalogStorage('atlas.catalog.gzip.v1:'+bomb),CatalogCapacityError);
});
test('catalog schema no longer stops imports at one hundred entries',()=>{
  assert.equal(catalogMaxEntries,500);
  const base=initialCatalog(),entry=base.entries[0];
  assert.ok(entry);
  assert.equal(catalogDocumentSchema.parse({...base,entries:Array.from({length:101},(_,i)=>({...entry,id:`entry-${i}`}))}).entries.length,101);
  assert.throws(()=>catalogDocumentSchema.parse({...base,entries:Array.from({length:501},(_,i)=>({...entry,id:`entry-${i}`}))}));
});
