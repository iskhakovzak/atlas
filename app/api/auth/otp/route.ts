import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,startOtp,verifyOtp} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

const channel=z.enum(['email','phone']);
const schema=z.discriminatedUnion('step',[
 z.object({step:z.literal('start'),channel,target:z.string().max(254)}),
 z.object({step:z.literal('verify'),channel,challengeId:z.string().max(64),code:z.string().max(12)}),
]);

export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,2000));
 if(!payload.success)throw new AuthError(400,'bad_request');
 const body=payload.data;
 if(body.step==='start')return authJson(await startOtp(body.channel,body.target,request));
 return authJson({ok:true},200,await verifyOtp(body.channel,body.challengeId,body.code.trim(),request));
}catch(error){return authFailure(error)}}
