import test from 'node:test';
import assert from 'node:assert/strict';
import {viewAccess,signInPath,memberViews,adminViews} from '../lib/market/access.ts';
import {applyAction} from '../lib/market/actions.ts';
import {blank} from '../lib/market/domain.ts';
import {preferredLocale} from '../lib/market/i18n.ts';
test('page language: saved choice, then browser language, then Uzbek by default',()=>{
 assert.equal(preferredLocale('atlas-language=en','ru-RU'),'en');
 assert.equal(preferredLocale(null,'ru-RU,uz;q=0.5'),'ru');
 assert.equal(preferredLocale(null,'uz-Latn-UZ,ru;q=0.8'),'uz');
 assert.equal(preferredLocale('atlas-language=xx','de-DE'),'uz');
 assert.equal(preferredLocale(undefined,undefined),'uz');
});
test('private screens never render before identity is confirmed, including admin pages',()=>{
 for(const route of [...memberViews,...adminViews]){
  assert.equal(viewAccess(route,'loading',true),'loading');
  assert.equal(viewAccess(route,'guest',true),'signin');
  assert.equal(viewAccess(route,'error',true),'error');
 }
 for(const route of adminViews){assert.equal(viewAccess(route,'authenticated',false),'forbidden');assert.equal(viewAccess(route,'authenticated',true),'allow')}
 for(const route of memberViews)assert.equal(viewAccess(route,'authenticated',false),'allow');
 for(const route of ['catalog','customs','legal','link'])assert.equal(viewAccess(route,'guest'),'allow');
});
test('sign-in preserves product intent but rejects external and recursive return destinations',()=>{
 const path='/order-by-link?url='+encodeURIComponent('https://www.nike.com/t/shoe');
 assert.equal(new URL(signInPath(path),'https://atlas.local').searchParams.get('return_to'),path);
 assert(signInPath(path).startsWith('/login?return_to='));
 for(const path of ['https://evil.test','//evil.test','/\\evil.test','/signin-with-chatgpt','/callback','/login','/login?return_to=%2F','/api/auth/logout'])assert.equal(signInPath(path),signInPath('/'));
});
test('customer support replies return a ticket to awaiting support, not answered',()=>{
 const state=applyAction(blank(),{type:'support-create',subject:'Доставка',text:'Где моя посылка?'},false);
 const next=applyAction(state,{type:'support-reply',id:state.supportTickets[0].id,text:'Уточнение адреса'},false);
 assert.equal(next.supportTickets[0].status,'open');
 assert.equal(next.supportTickets[0].replies.at(-1).author,'customer');
});
test('admin pages accept the account user shape: role permissions open only their sections',()=>{
 const support={operator:false,permissions:['operations.read','support.reply','customers.manage']};
 assert.equal(viewAccess('admin','authenticated',support),'allow');
 assert.equal(viewAccess('operations','authenticated',support),'allow');
 assert.equal(viewAccess('analytics','authenticated',support),'forbidden');
 assert.equal(viewAccess('admin','authenticated',{operator:false,permissions:[]}),'forbidden');
 assert.equal(viewAccess('admin','authenticated',{operator:true,permissions:[]}),'allow');
 assert.equal(viewAccess('analytics','authenticated',{operator:false,permissions:['finance.read']}),'allow');
});
