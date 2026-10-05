import {z} from 'zod';
import {requestJson,sameOrigin} from '@/lib/market/server';
import {AuthError,detachMethod,linkedMethods} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

// The signed-in account's sign-in methods: its own one and the ones attached to it.
export async function GET(){try{return authJson(await linkedMethods())}catch(error){return authFailure(error)}}

const schema=z.object({remove:z.string().min(4).max(300)});
export async function POST(request:Request){try{
 sameOrigin(request);
 const payload=schema.safeParse(await requestJson(request,1000));
 if(!payload.success)throw new AuthError(400,'bad_request');
 return authJson(await detachMethod(payload.data.remove));
}catch(error){return authFailure(error)}}
