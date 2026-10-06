import {AuthError,telegramWebhook} from '@/lib/auth/server';

// Telegram's updates for the sign-in bot. Anything but a wrong secret answers 200, so Telegram does not resend it.
export async function POST(request:Request){
 try{await telegramWebhook(request)}
 catch(error){
  if(error instanceof AuthError&&error.status===403)return new Response('forbidden',{status:403});
  if(!(error instanceof AuthError))console.error('Telegram bot update failed',error);
 }
 return new Response('ok');
}
