import {account,identity,json,failure,pricing,policy} from '@/lib/market/server';
import {operator} from '@/lib/market/server';
export async function GET(){try{const user=await identity();const [a,currentPricing,currentPolicy]=await Promise.all([account(user),pricing(),policy()]);return json({user:{name:a.name,email:user.email,operator:operator(user.email),createdAt:a.created_at},state:a.state,pricing:currentPricing,policy:currentPolicy,revision:a.revision})}catch(e){return failure(e)}}
