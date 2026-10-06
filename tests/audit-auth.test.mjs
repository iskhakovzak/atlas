import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AuthError,CODE_TTL_MS,MAX_CODE_ATTEMPTS,SESSION_RENEW_MS,SESSION_TTL_MS,hashCode,identityFor,sessionMatchesRevocation,sessionRevocationFor} from '../lib/auth/core.ts';
import {consumeChallenge,detachLinkedMethod,renewSessionRow} from '../lib/auth/session-store.ts';

// A D1-shaped adapter over in-memory SQLite: prepare(sql).bind(...).first/run/all and batch in one transaction.
function memoryD1(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`
  CREATE TABLE market_auth_sessions (id text PRIMARY KEY,user_id text NOT NULL,method text NOT NULL,email text,display_name text NOT NULL,contact text NOT NULL,created_at integer NOT NULL,expires_at integer NOT NULL);
  CREATE TABLE market_auth_challenges (id text PRIMARY KEY,kind text NOT NULL,target text NOT NULL,secret text NOT NULL,attempts integer NOT NULL DEFAULT 0,return_to text,created_at integer NOT NULL,expires_at integer NOT NULL);
  CREATE TABLE market_auth_links (subject text PRIMARY KEY,user_id text NOT NULL,method text NOT NULL,contact text NOT NULL,created_at integer NOT NULL);
 `);
 const statement=(sql,args=[])=>({
  sql,args,
  bind:(...values)=>statement(sql,values),
  first:async()=>sqlite.prepare(sql).get(...args)??null,
  run:async()=>sqlite.prepare(sql).run(...args),
  all:async()=>({results:sqlite.prepare(sql).all(...args)}),
 });
 return {
  sqlite,
  prepare:sql=>statement(sql),
  batch:async list=>{
   sqlite.exec('BEGIN');
   try{const results=list.map(item=>sqlite.prepare(item.sql).run(...item.args));sqlite.exec('COMMIT');return results}
   catch(error){sqlite.exec('ROLLBACK');throw error}
  },
 };
}

const expectAuthError=(status,code)=>error=>error instanceof AuthError&&error.status===status&&error.code===code;

// ---------- sessionRevocationFor ----------
test('sessionRevocationFor: one email subject covers email, Google and Apple sessions of that address', () => {
 assert.deepEqual(sessionRevocationFor('email:b@x.uz'),{methods:['email','google','apple'],contact:'b@x.uz'});
 // identityFor stores the address as contact for all three methods, so the rule matches what sessions hold.
 for(const method of ['email','google','apple']){
  const user=identityFor(method,'b@x.uz');
  assert.equal(user.userId,'email:b@x.uz');
  assert.equal(sessionMatchesRevocation(user,sessionRevocationFor(user.userId)),true);
 }
 assert.equal(sessionMatchesRevocation({method:'email',contact:'other@x.uz'},sessionRevocationFor('email:b@x.uz')),false);
 assert.equal(sessionMatchesRevocation({method:'phone',contact:'b@x.uz'},sessionRevocationFor('email:b@x.uz')),false);
});

test('sessionRevocationFor: a phone covers only phone sessions of that number; Telegram has no contact; others are null', () => {
 assert.deepEqual(sessionRevocationFor('phone:+998901234567'),{methods:['phone'],contact:'+998901234567'});
 assert.equal(sessionMatchesRevocation({method:'email',contact:'+998901234567'},sessionRevocationFor('phone:+998901234567')),false);
 const tg=sessionRevocationFor('tg:42');
 assert.deepEqual(tg,{methods:['telegram']});
 assert.equal('contact' in tg,false);
 // A Telegram contact is only a display name: every Telegram session matches.
 assert.equal(sessionMatchesRevocation({method:'telegram',contact:'Someone else · Telegram'},tg),true);
 for(const subject of ['apple:001','google:x','','email:','phone:','tg:','x:1'])assert.equal(sessionRevocationFor(subject),null,subject);
});

// ---------- detachLinkedMethod ----------
const NOW=1_800_000_000_000;
function seedAccounts(){
 const db=memoryD1();
 const session=(id,userId,method,contact)=>db.sqlite.prepare('INSERT INTO market_auth_sessions VALUES (?,?,?,?,?,?,?,?)').run(id,userId,method,method==='phone'||method==='telegram'?null:contact,contact,contact,NOW,NOW+SESSION_TTL_MS);
 const link=(subject,userId,method,contact)=>db.sqlite.prepare('INSERT INTO market_auth_links VALUES (?,?,?,?,?)').run(subject,userId,method,contact,NOW);
 // Account A: own email a@x.uz, attached phone, attached email b@x.uz and attached Telegram.
 link('phone:+998901234567','email:a@x.uz','phone','+998901234567');
 link('email:b@x.uz','email:a@x.uz','email','b@x.uz');
 link('tg:42','email:a@x.uz','telegram','Ali · Telegram');
 // Another account has its own link that A must never touch.
 link('phone:+998907654321','email:other@x.uz','phone','+998907654321');
 session('a-own','email:a@x.uz','email','a@x.uz');           // the current session
 session('a-phone','email:a@x.uz','phone','+998901234567');  // signed in through the attached phone
 session('a-moved','email:a@x.uz','phone','+998901234567');  // moved here by attachMethod from the phone's own empty account
 session('a-google-b','email:a@x.uz','google','b@x.uz');     // Google with the attached address
 session('a-apple-b','email:a@x.uz','apple','b@x.uz');       // Apple with the attached address
 session('a-tg','email:a@x.uz','telegram','Ali · Telegram');
 session('other-phone','phone:+998901234567','phone','+998901234567'); // someone else's account with the same number
 session('other-own','email:other@x.uz','email','other@x.uz');
 return db;
}
const sessionIds=db=>db.sqlite.prepare('SELECT id FROM market_auth_sessions ORDER BY id').all().map(row=>row.id);
const linkSubjects=db=>db.sqlite.prepare('SELECT subject FROM market_auth_links ORDER BY subject').all().map(row=>row.subject);
// What currentUser() looks up: the session row by id while it is live.
const liveSession=(db,id)=>db.sqlite.prepare('SELECT user_id FROM market_auth_sessions WHERE id=? AND expires_at>?').get(id,NOW)??null;
const current={method:'email',contact:'a@x.uz'};

test('detaching a phone ends only that phone\'s sessions of the account, including ones moved in by attachMethod', async () => {
 const db=seedAccounts();
 assert.deepEqual(await detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'phone:+998901234567',current}),{removed:true});
 assert.equal(liveSession(db,'a-phone'),null);
 assert.equal(liveSession(db,'a-moved'),null);
 assert.deepEqual(sessionIds(db),['a-apple-b','a-google-b','a-own','a-tg','other-own','other-phone']);
 assert.deepEqual(linkSubjects(db),['email:b@x.uz','phone:+998907654321','tg:42']);
 assert.equal(liveSession(db,'a-own').user_id,'email:a@x.uz');
});

test('detaching an attached email also ends Google and Apple sessions with that address', async () => {
 const db=seedAccounts();
 assert.deepEqual(await detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'email:b@x.uz',current}),{removed:true});
 assert.deepEqual(sessionIds(db),['a-moved','a-own','a-phone','a-tg','other-own','other-phone']);
 assert.deepEqual(linkSubjects(db),['phone:+998901234567','phone:+998907654321','tg:42']);
});

test('detaching Telegram ends every Telegram session of the account only', async () => {
 const db=seedAccounts();
 assert.deepEqual(await detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'tg:42',current}),{removed:true});
 assert.deepEqual(sessionIds(db),['a-apple-b','a-google-b','a-moved','a-own','a-phone','other-own','other-phone']);
});

test('a foreign, missing or own subject deletes nothing', async () => {
 const db=seedAccounts();
 const before={sessions:sessionIds(db),links:linkSubjects(db)};
 for(const subject of ['phone:+998907654321','phone:+998900000000','email:a@x.uz','email:other@x.uz','apple:001','']){
  assert.deepEqual(await detachLinkedMethod(db,{userId:'email:a@x.uz',subject,current}),{removed:false},subject);
 }
 assert.deepEqual({sessions:sessionIds(db),links:linkSubjects(db)},before);
});

test('the method of the current session cannot be detached from it (409 link_current), and nothing changes', async () => {
 const db=seedAccounts();
 const before={sessions:sessionIds(db),links:linkSubjects(db)};
 await assert.rejects(detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'phone:+998901234567',current:{method:'phone',contact:'+998901234567'}}),expectAuthError(409,'link_current'));
 await assert.rejects(detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'email:b@x.uz',current:{method:'google',contact:'b@x.uz'}}),expectAuthError(409,'link_current'));
 // Any Telegram session counts as the current method: Atlas cannot tell which Telegram account opened it.
 await assert.rejects(detachLinkedMethod(db,{userId:'email:a@x.uz',subject:'tg:42',current:{method:'telegram',contact:'Telegram'}}),expectAuthError(409,'link_current'));
 assert.deepEqual({sessions:sessionIds(db),links:linkSubjects(db)},before);
});

// ---------- consumeChallenge (one-time sign-in codes) ----------
const PEPPER='test-pepper';
const CHALLENGE='abcdefghijklmnopqrstuvwx';
async function seedChallenge(db,{kind='email',code='123456',createdAt=NOW}={}){
 db.sqlite.prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,created_at,expires_at) VALUES (?,?,?,?,0,?,?)')
  .run(CHALLENGE,kind,'a@x.uz',await hashCode(CHALLENGE,code,PEPPER),createdAt,createdAt+CODE_TTL_MS);
}
const consume=(db,code,{channel='email',now=NOW+1000}={})=>consumeChallenge(db,{challengeId:CHALLENGE,channel,code,pepper:PEPPER,now});

test('consumeChallenge: five wrong codes, then even the right one is refused', async () => {
 const db=memoryD1();await seedChallenge(db);
 for(let attempt=0;attempt<MAX_CODE_ATTEMPTS;attempt++)await assert.rejects(consume(db,'000000'),expectAuthError(400,'invalid_code'));
 await assert.rejects(consume(db,'123456'),expectAuthError(400,'code_expired'));
});

test('consumeChallenge: the right code on the fifth attempt passes and is then spent', async () => {
 const db=memoryD1();await seedChallenge(db);
 for(let attempt=0;attempt<MAX_CODE_ATTEMPTS-1;attempt++)await assert.rejects(consume(db,'000000'),expectAuthError(400,'invalid_code'));
 assert.equal(await consume(db,'123456'),'a@x.uz');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM market_auth_challenges').get().n,0);
 await assert.rejects(consume(db,'123456'),expectAuthError(400,'code_expired'));
});

test('consumeChallenge: a code works once', async () => {
 const db=memoryD1();await seedChallenge(db);
 assert.equal(await consume(db,'123456'),'a@x.uz');
 await assert.rejects(consume(db,'123456'),expectAuthError(400,'code_expired'));
});

test('consumeChallenge: the code lives exactly CODE_TTL_MS', async () => {
 const late=memoryD1();await seedChallenge(late);
 await assert.rejects(consume(late,'123456',{now:NOW+CODE_TTL_MS}),expectAuthError(400,'code_expired'));
 const inTime=memoryD1();await seedChallenge(inTime);
 assert.equal(await consume(inTime,'123456',{now:NOW+CODE_TTL_MS-1}),'a@x.uz');
});

test('consumeChallenge: an email code does not open the SMS channel', async () => {
 const db=memoryD1();await seedChallenge(db,{kind:'email'});
 await assert.rejects(consume(db,'123456',{channel:'phone'}),expectAuthError(400,'code_expired'));
 // The wrong channel spent no attempt: the email channel still accepts the code.
 assert.equal(db.sqlite.prepare('SELECT attempts FROM market_auth_challenges').get().attempts,0);
 assert.equal(await consume(db,'123456'),'a@x.uz');
});

// ---------- renewSessionRow (sliding 60-day sessions) ----------
function seedSession(db,expiresAt){
 db.sqlite.prepare('INSERT INTO market_auth_sessions VALUES (?,?,?,?,?,?,?,?)').run('hash','email:a@x.uz','email','a@x.uz','a@x.uz','a@x.uz',NOW,expiresAt);
}
const expiresAt=db=>db.sqlite.prepare('SELECT expires_at FROM market_auth_sessions WHERE id=?').get('hash').expires_at;

test('renewSessionRow: not again within a day of the last renewal', async () => {
 const db=memoryD1();seedSession(db,NOW+SESSION_TTL_MS);
 assert.equal(await renewSessionRow(db,'hash',NOW+SESSION_RENEW_MS-1),false);
 assert.equal(await renewSessionRow(db,'hash',NOW+SESSION_RENEW_MS),false);
 assert.equal(expiresAt(db),NOW+SESSION_TTL_MS);
});

test('renewSessionRow: a day after the last renewal the end moves to 60 days from now', async () => {
 const db=memoryD1();seedSession(db,NOW+SESSION_TTL_MS);
 const later=NOW+SESSION_RENEW_MS+1;
 assert.equal(await renewSessionRow(db,'hash',later),true);
 assert.equal(expiresAt(db),later+SESSION_TTL_MS);
 assert.equal(await renewSessionRow(db,'hash',later+1),false);
});

test('renewSessionRow: an expired or unknown session is not revived', async () => {
 const db=memoryD1();seedSession(db,NOW);
 assert.equal(await renewSessionRow(db,'hash',NOW),false);
 assert.equal(await renewSessionRow(db,'hash',NOW+1),false);
 assert.equal(expiresAt(db),NOW);
 assert.equal(await renewSessionRow(db,'missing',NOW-SESSION_RENEW_MS),false);
});
