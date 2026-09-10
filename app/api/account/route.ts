import {account,identity,json,failure,pricing} from '@/lib/market/server';
import {operator} from '@/lib/market/server';
export async function GET(){try{const user=await identity();const [a,currentPricing]=await Promise.all([account(user),pricing()]);return json({user:{name:a.name,email:user.email,operator:operator(user.email),createdAt:a.created_at},state:a.state,pricing:currentPricing,revision:a.revision})}catch(e){return failure(e)}}
