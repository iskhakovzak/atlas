import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,linkTelegram,signInWithTelegram} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

const field=z.union([z.string().max(512),z.number()]).optional().nullable();
const schema=z.object({id:z.union([z.string().max(20),z.number()]),auth_date:z.union([z.string().max(20),z.number()]),hash:z.string().max(64),first_name:field,last_name:field,username:field,photo_url:field,link:z.boolean().optional()});

// The widget's JS callback posts here (instead of a redirect URL) so the same-origin check applies.
export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,4000));
 if(!payload.success)throw new AuthError(400,'telegram_invalid');
 // link: attaches this Telegram account to the signed-in account instead of signing in.
 const {link,...fields}=payload.data;
 if(link){await linkTelegram(fields,request);return authJson({ok:true,linked:true})}
 return authJson({ok:true},200,await signInWithTelegram(fields,request));
}catch(error){return authFailure(error)}}
