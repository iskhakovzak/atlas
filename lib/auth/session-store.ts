// D1 statements of the sign-in code check, session renewal and detaching a sign-in method.
// Kept apart from server.ts (no cloudflare:workers, no next/headers) so tests can run them against SQLite.
import {AuthError,MAX_CODE_ATTEMPTS,SESSION_RENEW_MS,SESSION_TTL_MS,constantTimeEqual,hashCode,sessionMatchesRevocation,sessionRevocationFor} from './core.ts';

/** The part of a D1 binding these functions use. */
export type AuthStatement={
 bind(...values:unknown[]):AuthStatement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run():Promise<unknown>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
};
export type AuthDb={prepare(sql:string):AuthStatement;batch(statements:AuthStatement[]):Promise<unknown>};

/**
 * Spends one attempt of a sign-in code challenge and, when the code is right, deletes the challenge.
 * Returns the challenge's target (address or phone) or throws code_expired / invalid_code.
 */
export async function consumeChallenge(db:AuthDb,input:{challengeId:string;channel:string;code:string;pepper:string;now:number}){
 const {challengeId,channel,code,pepper,now}=input;
 const row=await db.prepare('UPDATE market_auth_challenges SET attempts=attempts+1 WHERE id=? AND kind=? AND expires_at>? AND attempts<? RETURNING target,secret')
  .bind(challengeId,channel,now,MAX_CODE_ATTEMPTS).first<{target:string;secret:string}>();
 if(!row)throw new AuthError(400,'code_expired');
 if(!constantTimeEqual(await hashCode(challengeId,code,pepper),row.secret))throw new AuthError(400,'invalid_code');
 // Deleting with RETURNING makes the code single-use even under concurrent submissions.
 const used=await db.prepare('DELETE FROM market_auth_challenges WHERE id=? RETURNING id').bind(challengeId).first();
 if(!used)throw new AuthError(400,'code_expired');
 return row.target;
}

/** Moves a live session's end to 60 days from now, at most once a day. True when the row changed. */
export async function renewSessionRow(db:AuthDb,tokenHash:string,now:number):Promise<boolean>{
 const row=await db.prepare('UPDATE market_auth_sessions SET expires_at=? WHERE id=? AND expires_at>? AND expires_at<? RETURNING id')
  .bind(now+SESSION_TTL_MS,tokenHash,now,now+SESSION_TTL_MS-SESSION_RENEW_MS).first();
 return !!row;
}

/**
 * Detaches a method attached to the account and ends the account's sessions opened through it (on every
 * device). A subject that is not attached to this account deletes nothing. The method the current session
 * came through cannot be detached from that session (409 link_current): sign in another way first.
 */
export async function detachLinkedMethod(db:AuthDb,input:{userId:string;subject:string;current:{method:string;contact:string}}):Promise<{removed:boolean}>{
 const {userId,subject,current}=input;
 const link=await db.prepare('SELECT subject FROM market_auth_links WHERE subject=? AND user_id=?').bind(subject,userId).first<{subject:string}>();
 const rule=sessionRevocationFor(subject);
 if(!link||!rule)return {removed:false};
 if(sessionMatchesRevocation(current,rule))throw new AuthError(409,'link_current');
 const marks=rule.methods.map(()=>'?').join(',');
 const sessions=rule.contact===undefined
  ?db.prepare(`DELETE FROM market_auth_sessions WHERE user_id=? AND method IN (${marks})`).bind(userId,...rule.methods)
  :db.prepare(`DELETE FROM market_auth_sessions WHERE user_id=? AND method IN (${marks}) AND contact=?`).bind(userId,...rule.methods,rule.contact);
 await db.batch([
  db.prepare('DELETE FROM market_auth_links WHERE subject=? AND user_id=?').bind(subject,userId),
  sessions,
 ]);
 return {removed:true};
}
