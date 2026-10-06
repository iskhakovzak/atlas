import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,startApple,startAppleNative,verifyAppleNative} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';
import {loginPath,safeReturnTo} from '@/lib/auth/return-to';

// GET: the web flow (Services ID) → Apple's authorize page; Apple posts back to /api/auth/apple/callback.
export async function GET(request:Request){
 try{return await startApple(request)}
 catch(error){
  console.error('Apple sign-in start failed',error);
  const returnTo=safeReturnTo(new URL(request.url).searchParams.get('return_to'));
  return new Response(null,{status:303,headers:{Location:loginPath(returnTo)+'&error=apple','Cache-Control':'no-store'}});
 }
}

// POST: the iOS app's system sheet. start → {challengeId, nonce}; verify → session cookie (or {linked:true}).
const schema=z.discriminatedUnion('step',[
 z.object({step:z.literal('start')}),
 z.object({step:z.literal('verify'),challengeId:z.string().max(64),identityToken:z.string().max(8192),authorizationCode:z.string().max(2048).optional(),
  user:z.object({givenName:z.string().max(120).optional(),familyName:z.string().max(120).optional()}).nullable().optional(),link:z.boolean().optional()}),
]);
export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,16000));
 if(!payload.success)throw new AuthError(400,'bad_request');
 const body=payload.data;
 if(body.step==='start')return authJson(await startAppleNative(request));
 const result=await verifyAppleNative(body,request);
 return authJson(result.body,200,result.cookie);
}catch(error){return authFailure(error)}}
