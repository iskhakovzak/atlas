import {identity,operator,sameOrigin} from '@/lib/market/server';
import {connectTelegramBot,telegramBotStatus} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

// Operator only: whether the sign-in bot is connected, and connecting its webhook to this site.
async function operatorOnly(){const user=await identity();if(!operator(user.email))return null;return user}
export async function GET(){try{
 if(!await operatorOnly())return authJson({error:'forbidden'},403);
 return authJson(await telegramBotStatus());
}catch(error){return authFailure(error)}}
export async function POST(request:Request){try{
 sameOrigin(request);
 const user=await operatorOnly();
 if(!user)return authJson({error:'forbidden'},403);
 try{return authJson({ok:true,...await connectTelegramBot(new URL(request.url).origin,user.email)})}
 catch(error){if(error instanceof Error&&error.message.startsWith('Telegram '))return authJson({error:'telegram_api',detail:error.message.slice(0,200)},502);throw error}
}catch(error){return authFailure(error)}}
