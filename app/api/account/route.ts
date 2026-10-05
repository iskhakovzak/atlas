import {account,identity,json,failure,pricingAndPolicy} from '@/lib/market/server';
import {operator} from '@/lib/market/server';
import {renewSession} from '@/lib/auth/server';
export async function GET(request:Request){try{const user=await identity();const [a,settings]=await Promise.all([account(user),pricingAndPolicy()]);const response=json({user:{name:a.name,email:user.email,contact:user.contact,method:user.method,operator:operator(user.email),createdAt:a.created_at},state:a.state,pricing:settings.pricing,policy:settings.policy,revision:a.revision});
 // The account is read on every visit: that is where an active session slides forward. A failed renewal never fails the read.
 const renewed=await renewSession(request).catch(()=>null);if(renewed)response.headers.append('Set-Cookie',renewed);
 return response}catch(e){return failure(e,request)}}
