import {withoutAuthor} from '@/lib/market/pricing-equal';
import {account,identity,json,failure,pricingAndPolicy} from '@/lib/market/server';
import {accessFor} from '@/lib/market/server';
import {renewSession} from '@/lib/auth/server';
// `operator` stays "administrator"; `role` and `permissions` come from the staff directory (lib/market/access.ts).
// The account is read on every visit: that is where an active session slides forward. A failed renewal never fails the read;
// it goes out together with the reads instead of after them.
export async function GET(request:Request){try{const user=await identity();const [a,settings,access,renewed]=await Promise.all([account(user),pricingAndPolicy(),accessFor(user),renewSession(request).catch(()=>null)]);const response=json({user:{name:a.name,email:user.email,contact:user.contact,method:user.method,operator:access.operator,role:access.role,permissions:access.permissions,createdAt:a.created_at},state:a.state,pricing:withoutAuthor(settings.pricing),policy:withoutAuthor(settings.policy),revision:a.revision});
 if(renewed)response.headers.append('Set-Cookie',renewed);
 return response}catch(e){return failure(e,request)}}
