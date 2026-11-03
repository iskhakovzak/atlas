// Sign-in abuse alerts (3.11.2026): a sign-in limit that starts refusing (429) and a code challenge spent on
// wrong guesses are kept in market_operational_errors (area "auth", Админ → Система) and told to the owner's
// Telegram through the import monitor's channel. One row per kind while it stays open (a counter, the latest
// limit and masked contact), at most one Telegram message per hour. Nothing here names a person beyond a masked
// address or phone, and nothing holds an IP. No Cloudflare imports: lib/auth/server.ts passes the database and sender.

export type AbuseStatement={
 bind(...values:unknown[]):AbuseStatement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run():Promise<{meta?:{changes?:number}}|unknown>;
};
export type AbuseDb={prepare(sql:string):AbuseStatement};

export type AbuseKind='rate_limit'|'wrong_codes';
export type AbuseEvent={kind:AbuseKind;/** The limit without its variable part, e.g. "send:10m", "verify-ip". */limit:string;/** Masked: "a**@example.uz", "+99890*****67". */contact?:string};
export type AbuseDeps={db:AbuseDb;now:number;/** One Telegram message (HTML) to the owner; absent when the monitor is off. */send?:(html:string)=>Promise<void>};

export const ABUSE_AREA='auth';
export const ABUSE_MESSAGES:Record<AbuseKind,string>={
 rate_limit:'Sign-in limit reached (429)',
 wrong_codes:'Sign-in code: all attempts wrong',
};
const hour=60*60*1000;
/** Events per hour before the owner hears about weak signals (one person asking for a code too often). */
export const ABUSE_ALERT_THRESHOLD=3;
/** An open row keeps counting for a day; after that a new row starts. */
const groupMs=24*hour;

/** The limits worth watching and what they mean in the owner's words. Strong ones alert on the first event. */
const watched:Record<string,{words:string;strong:boolean}>={
 'send:10m':{words:'коды на один адрес или номер (больше 3 за 10 минут)',strong:false},
 'send:day':{words:'коды на один адрес или номер (больше 10 за сутки)',strong:false},
 'send-ip':{words:'запросы кодов с одного IP (больше 20 за час)',strong:true},
 'verify-ip':{words:'проверки кодов с одного IP (больше 60 за час)',strong:true},
 'telegram-ip':{words:'входы через Telegram с одного IP (больше 30 за час)',strong:true},
 'ticket-ip':{words:'привязки способов входа с одного IP (больше 30 за час)',strong:true},
 'handoff-ip':{words:'передачи входа в приложение с одного IP (больше 60 за час)',strong:true},
 'google-ip':{words:'входы через Google с одного IP (больше 30 за час)',strong:true},
 'apple-ip':{words:'входы через Apple с одного IP (больше 30 за час)',strong:true},
 'telegram-bot-start':{words:'запуски входа через бота с одного IP (больше 60 за час)',strong:true},
 'telegram-bot-check':{words:'проверки входа через бота с одного IP (больше 900 за 10 минут)',strong:true},
 'code-attempts':{words:'5 неверных кодов подряд для одного входа',strong:false},
};

/**
 * The stable part of a limit key: "send:<hash>:10m" → "send:10m", "verify-ip:<hash>" → "verify-ip".
 * Hashes and ids never reach the log.
 */
export function limitName(key:string){
 const [head,,tail]=key.split(':');
 return head==='send'&&tail?`send:${tail}`:head;
}
export const watchedLimit=(name:string)=>name in watched;

/** "ann@example.uz" → "a**@example.uz"; "+998901234567" → "+99890*****67". Anything else: undefined. */
export function maskContact(channel:'email'|'phone',target:string){
 if(channel==='email'){
  const at=target.lastIndexOf('@');
  if(at<1)return undefined;
  const local=target.slice(0,at);
  return (local.length>1?local[0]+'*'.repeat(Math.min(local.length-1,6)):'*')+target.slice(at);
 }
 const digits=target.replace(/\D/g,'');
 if(digits.length<7)return undefined;
 return '+'+digits.slice(0,5)+'*'.repeat(digits.length-7)+digits.slice(-2);
}

const escapeHtml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** The owner's message: what tripped, the masked contact, how many events this hour. */
export function abuseAlertText(event:AbuseEvent,eventsThisHour:number){
 const words=watched[event.limit]?.words??event.limit;
 return [
  '🛡 <b>Atlas: подозрительные попытки входа</b>',
  `Сработало: ${escapeHtml(words)}`,
  event.contact?`Контакт: ${escapeHtml(event.contact)}`:'',
  `Событий за час: ${eventsThisHour}`,
  'Подробности — Админ → Система (ошибки «auth»). Следующее сообщение — не раньше чем через час.',
 ].filter(Boolean).join('\n');
}

async function bump(db:AbuseDb,key:string,expiresAt:number){
 const row=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,expiresAt).first<{count:number}>();
 return row?.count??1;
}

/**
 * Keeps one event and, when it is strong or the hour already holds ABUSE_ALERT_THRESHOLD events, tells the owner
 * once per hour. Never throws: a failed record must not change the answer the visitor gets.
 */
export async function recordAbuse(deps:AbuseDeps,event:AbuseEvent):Promise<{alerted:boolean}>{
 const {db,now}=deps;
 if(!watchedLimit(event.limit))return {alerted:false};
 try{
  const message=ABUSE_MESSAGES[event.kind];
  const latest={limit:event.limit,...(event.contact?{contact:event.contact}:{})};
  const updated=await db.prepare(`UPDATE market_operational_errors SET details=json_set(details,'$.count',coalesce(json_extract(details,'$.count'),1)+1,'$.lastSeen',?,'$.limit',?,'$.contact',?)
   WHERE id=(SELECT id FROM market_operational_errors WHERE area=? AND message=? AND resolved_at IS NULL AND created_at>? AND json_valid(details) ORDER BY created_at DESC LIMIT 1)`)
   .bind(now,event.limit,event.contact??null,ABUSE_AREA,message,now-groupMs).run() as {meta?:{changes?:number}};
  if(!updated?.meta?.changes){
   await db.prepare('INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(),ABUSE_AREA,message,JSON.stringify({...latest,count:1,lastSeen:now}),now).run();
  }
  const bucket=Math.floor(now/hour),expires=(bucket+1)*hour;
  const events=await bump(db,`auth-abuse:events:${bucket}`,expires);
  if(!deps.send||!(watched[event.limit].strong||events>=ABUSE_ALERT_THRESHOLD))return {alerted:false};
  if(await bump(db,`auth-abuse:alert:${bucket}`,expires)!==1)return {alerted:false};
  await deps.send(abuseAlertText(event,events));
  return {alerted:true};
 }catch(error){
  console.error('Sign-in abuse not recorded',String(error).slice(0,200));
  return {alerted:false};
 }
}
