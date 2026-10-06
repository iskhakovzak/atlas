import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,claimHandoff,issueLinkTicket} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

// The Atlas apps and the system browser meet here.
// {code,verifier}: the app's web view trades the code from uz.atlasmarket.app://auth?code=… for its session (single use,
// 2 minutes) together with the PKCE verifier it kept when it opened the flow (RFC 8252 §8.6).
// {ticket:true}: the signed-in web view gets a ticket to open a link flow (Google/Apple ?link=1&native=1&ticket=…) outside.
const schema=z.union([z.object({code:z.string().max(64),verifier:z.string().max(128)}),z.object({ticket:z.literal(true)})]);
export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,1000));
 if(!payload.success)throw new AuthError(400,'bad_request');
 if('ticket' in payload.data)return authJson(await issueLinkTicket(request));
 const result=await claimHandoff({code:payload.data.code,verifier:payload.data.verifier},request);
 return authJson(result.body,200,result.cookie);
}catch(error){return authFailure(error)}}
