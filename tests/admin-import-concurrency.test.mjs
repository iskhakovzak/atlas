import test from 'node:test';
import assert from 'node:assert/strict';
import {routeHarness} from './support/route-harness.mjs';
import {importDraft} from '../lib/market/catalog-editor.ts';
import {tariff} from '../lib/market/domain.ts';

const owner = {userId:'email:owner@atlas.test',email:'owner@atlas.test'};
const sourceUrl = 'https://www.hoka.com/products/admin-import-fixture';
const image = 'https://cdn.shopify.com/example.jpg';
const collection = {id:'new-collection',name:'Parallel edit',nameUz:'',nameEn:'',description:'',visible:true,position:0};
const emptyCatalog = {revision:1,entries:[],collections:[],bundledSyncDisabled:true};

function storeCatalog(h, document) {
  h.db.sqlite.prepare(`INSERT INTO market_settings (key,value,updated_at,updated_by)
    VALUES ('catalog',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .run(JSON.stringify(document),Date.now(),owner.userId);
}

function storePricing(h) {
  h.db.sqlite.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('pricing',?,?,?)")
    .run(JSON.stringify({...tariff,fxSource:'manual'}),Date.now(),owner.userId);
}

function beforeCatalogWrite(h, update) {
  const batch = h.db.batch;
  let called = false;
  h.db.batch = async statements => {
    if (!called && statements.some(item => item.sql.includes("VALUES ('catalog',"))) {
      called = true;
      update();
    }
    return batch(statements);
  };
}

function mockStore(t) {
  const requests = [];
  t.mock.method(globalThis,'fetch',async input => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
    if (url === sourceUrl + '.js') return Response.json({
      handle:'admin-import-fixture',
      title:'Fixture Hoka shoes',
      vendor:'HOKA',
      options:[{name:'Size'}],
      images:[image],
      variants:[{id:1,title:'8',option1:'8',price:4200,available:true}],
    });
    assert.equal(url,sourceUrl);
    return new Response('<html><head><meta property="og:title" content="Fixture Hoka shoes"><script src="https://cdn.shopify.com/s/files/theme.js"></script><script>Shopify.shop = "hoka-us.myshopify.com"; Shopify.currency = {"active":"USD","rate":"1.0"};</script></head></html>',{
      headers:{'Content-Type':'text/html'},
    });
  });
  return requests;
}

test('a claimed batch saves on the latest head and keeps one result per input without rereading duplicate links',async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  storeCatalog(h,emptyCatalog);
  storePricing(h);
  const {POST} = await h.route('app/api/catalog/route.ts');
  const cookie = h.signIn(owner);
  const send = (command, revision = 0) => h.call(POST,{url:'/api/catalog',method:'POST',cookie,body:{command,revision}});
  const urls = [sourceUrl + '?gclid=first',sourceUrl + '?fbclid=second','https://www.hoka.com:8443/products/admin-import-fixture'];
  const start = await send({kind:'batch-start',urls,country:'США',collectionIds:[]});
  assert.equal(start.status,200);
  const {batchJob} = await start.json();
  const requests = mockStore(t);
  beforeCatalogWrite(h,() => storeCatalog(h,{...emptyCatalog,revision:2,collections:[collection]}));
  const response = await send({kind:'batch-step',id:batchJob.id});
  assert.equal(response.status,200);
  const {document,results,batchJob:finished} = await response.json();
  assert.deepEqual(requests,[sourceUrl,sourceUrl+'.js']);
  assert.equal(document.revision,3);
  assert.deepEqual(document.collections,[collection]);
  assert.equal(document.entries.length,1);
  assert.equal(document.entries[0].published.price,42);
  assert.deepEqual(results.map(row => row.url),urls);
  assert.deepEqual(results.map(row => row.status),['saved','saved','failed']);
  assert.equal(results[0].id,results[1].id);
  assert.equal(finished.status,'completed');
  assert.equal(finished.leaseUntil,0);
  assert.deepEqual(finished.results,results);
  const read = h.db.sqlite.prepare("SELECT details FROM market_audit_events WHERE action='catalog.import-batch'").all();
  assert.equal(read.length,1);
  assert.deepEqual(JSON.parse(read[0].details),{revision:3,count:1,failed:1});
});

test('an overlapping refresh cannot restore a listing with a newer sold-out observation',async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  storePricing(h);
  const old = importDraft({
    sourceUrl,title:'Fixture Hoka shoes',image,images:[image],currency:'USD',price:35,warnings:[],
    variants:[{id:'1',label:'8',price:35,available:true,availabilityKnown:true,image}],
  },[],'США',Date.now()-1000);
  const entry = {id:'fixture',draft:old,published:old,queueState:'published'};
  storeCatalog(h,{...emptyCatalog,entries:[entry]});
  const requests = mockStore(t);
  beforeCatalogWrite(h,() => storeCatalog(h,{...emptyCatalog,revision:2,entries:[{
    id:'fixture',draft:{...old,soldOut:true},queueState:'published',autoHiddenAt:Date.now(),
    refresh:{status:'sold-out',lastSuccessAt:Date.now()+1},
  }]}));
  const {POST} = await h.route('app/api/catalog/route.ts');
  const response = await h.call(POST,{url:'/api/catalog',method:'POST',cookie:h.signIn(owner),body:{
    revision:1,command:{kind:'import',url:sourceUrl,country:'США',collectionIds:[]},
  }});
  assert.equal(response.status,409);
  assert.deepEqual(requests,[sourceUrl,sourceUrl+'.js']);
  const {readCatalog} = await h.route('lib/market/catalog-server.ts');
  const {document} = await readCatalog();
  assert.equal(document.revision,2);
  assert.equal(document.entries[0].refresh.status,'sold-out');
  assert.equal(document.entries[0].published,undefined);
});

test('batch progress survives an operator pausing the job during finalization',async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  const {startBatch,claimBatch,finishBatch} = await h.route('lib/market/catalog-batch-server.ts');
  const urls = Array.from({length:11},(_,n) => `https://www.hoka.com/products/fixture-${n}`);
  const job = await startBatch(owner.userId,{urls,collectionIds:[],country:'США'},{email:owner.email,method:'email'});
  const {claim,urls:claimed} = await claimBatch(owner.userId,job.id);
  const prepare = h.db.prepare;
  let paused = false;
  h.db.prepare = sql => {
    const prepared = prepare(sql);
    if (!sql.startsWith('UPDATE market_settings SET value=')) return prepared;
    return {...prepared,bind(...args){
      const bound = prepared.bind(...args);
      return {...bound,async run(){
        if (!paused && args[3] === 'catalog-batch:'+owner.userId) {
          const value = JSON.parse(args[4]);
          h.db.sqlite.prepare('UPDATE market_settings SET value=? WHERE key=?')
            .run(JSON.stringify({...value,status:'paused'}),args[3]);
          paused = true;
        }
        return bound.run();
      }};
    }};
  };
  const done = await finishBatch(owner.userId,job.id,claim,claimed.map(url => ({url,status:'saved'})));
  assert.ok(paused);
  assert.equal(done.status,'paused');
  assert.equal(done.leaseUntil,0);
  assert.equal(done.results.length,10);
});

test('admin short-link resolution validates HTTPS before trying a redirect',async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  const {storePageUrl} = await h.route('lib/market/catalog-import-server.ts');
  const request = t.mock.method(globalThis,'fetch',async () => { throw new Error('Unexpected fetch'); });
  await assert.rejects(storePageUrl('http://a.co/example'),/HTTPS/);
  assert.equal(request.mock.callCount(),0);
});
