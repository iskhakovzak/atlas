import {account,identity,json,failure,pricingAndPolicy} from '@/lib/market/server';
import {operator} from '@/lib/market/server';
export async function GET(request:Request){try{const user=await identity();const [a,settings]=await Promise.all([account(user),pricingAndPolicy()]);return json({user:{name:a.name,email:user.email,contact:user.contact,method:user.method,operator:operator(user.email),createdAt:a.created_at},state:a.state,pricing:settings.pricing,policy:settings.policy,revision:a.revision})}catch(e){return failure(e,request)}}
