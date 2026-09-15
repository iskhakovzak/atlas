import test from 'node:test';
import assert from 'node:assert/strict';
import {viewAccess,signInPath,memberViews,adminViews} from '../lib/market/access.ts';
import {applyAction} from '../lib/market/actions.ts';
import {blank} from '../lib/market/domain.ts';
test('private screens never render before identity is confirmed, including admin pages',()=>{
 for(const route of [...memberViews,...adminViews]){
  assert.equal(viewAccess(route,'loading',true),'loading');
  assert.equal(viewAccess(route,'guest',true),'signin');
  assert.equal(viewAccess(route,'error',true),'error');
 }
 for(const route of adminViews){assert.equal(viewAccess(route,'authenticated',false),'forbidden');assert.equal(viewAccess(route,'authenticated',true),'allow')}
 for(const route of memberViews)assert.equal(viewAccess(route,'authenticated',false),'allow');
 for(const route of ['catalog','customs','legal'])assert.equal(viewAccess(route,'guest'),'allow');
});
test('sign-in preserves product intent but rejects external and recursive return destinations',()=>{
 const path='/order-by-link?url='+encodeURIComponent('https://www.nike.com/t/shoe');
 assert.equal(new URL(signInPath(path),'https://atlas.local').searchParams.get('return_to'),path);
 for(const path of ['https://evil.test','//evil.test','/\\evil.test','/signin-with-chatgpt','/callback'])assert.equal(signInPath(path),signInPath('/'));
});
test('customer support replies return a ticket to awaiting support, not answered',()=>{
 const state=applyAction(blank(),{type:'support-create',subject:'Доставка',text:'Где моя посылка?'},false);
 const next=applyAction(state,{type:'support-reply',id:state.supportTickets[0].id,text:'Уточнение адреса'},false);
 assert.equal(next.supportTickets[0].status,'open');
 assert.equal(next.supportTickets[0].replies.at(-1).author,'customer');
});
