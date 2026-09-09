import {account,identity,json,failure} from '@/lib/market/server';
import {operator} from '@/lib/market/server';
export async function GET(){try{const user=await identity();const a=await account(user);return json({user:{name:a.name,email:user.email,operator:operator(user.email),createdAt:a.created_at},state:a.state,revision:a.revision})}catch(e){return failure(e)}}
