import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,checkTelegramBot,startTelegramBot} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';
import {TG_LOGIN_COOKIE} from '@/lib/auth/telegram-bot';
import {cookie} from '@/lib/auth/core';

const schema=z.discriminatedUnion('step',[
 z.object({step:z.literal('start'),link:z.boolean().optional()}),
 z.object({step:z.literal('check'),token:z.string().max(64)}),
]);

// Sign-in through the bot: "start" gives this browser a one-time Telegram link, "check" signs in once the bot confirmed it.
export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,1000));
 if(!payload.success)throw new AuthError(400,'telegram_invalid');
 if(payload.data.step==='start'){const started=await startTelegramBot(request,!!payload.data.link);return authJson(started.body,200,started.cookie)}
 const result=await checkTelegramBot(request,payload.data.token);
 if(result.status==='done')return authJson({status:'done'},200,[result.cookie,cookie(TG_LOGIN_COOKIE,'',0)]);
 return authJson(result);
}catch(error){return authFailure(error)}}
