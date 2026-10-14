import {AuthError,telegramWebhook} from '@/lib/auth/server';
import {telegramNoticeHooks} from '@/lib/market/telegram-notices-server';

// Telegram's updates for the sign-in bot and its order notices (/stop, /start notify, replies). Anything but a wrong secret answers 200, so Telegram does not resend it.
export async function POST(request:Request){
 try{await telegramWebhook(request,telegramNoticeHooks)}
 catch(error){
  if(error instanceof AuthError&&error.status===403)return new Response('forbidden',{status:403});
  if(!(error instanceof AuthError))console.error('Telegram bot update failed',error);
 }
 return new Response('ok');
}
