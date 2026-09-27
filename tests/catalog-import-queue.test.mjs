import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogImportBatchSize,parseCatalogImportQueue,removeImportedCatalogLinks} from '../lib/market/catalog-import-queue.ts';

test('catalog link queue keeps every unique link and counts duplicates without truncating',()=>{
 const links=Array.from({length:11},(_,index)=>`https://store.example/item-${index+1}`);
 const parsed=parseCatalogImportQueue(`${links.join('\n')}\n${links[0]}\n`);
 assert.equal(parsed.links.length,11);
 assert.equal(parsed.duplicates,1);
 assert.equal(parsed.links[catalogImportBatchSize],links[10]);
});

test('completed catalog links are removed while failed and unprocessed links remain',()=>{
 const links=['https://store.example/saved','https://store.example/failed','https://store.example/next'];
 assert.equal(removeImportedCatalogLinks(`${links.join('\n')}\n${links[0]}`,[links[0]]),`${links[1]}\n${links[2]}`);
});
