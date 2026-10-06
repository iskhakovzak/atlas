import {z} from 'zod';
import {account,failure,HttpError,identity,json,rateLimit,requestJson,sameOrigin} from '@/lib/market/server';
import {endSession} from '@/lib/auth/server';
import {balanceOf} from '@/lib/market/domain';
import {deletionBlockers} from '@/lib/market/account-delete';
import {deleteAccount} from '@/lib/market/account-delete-server';

const schema=z.object({confirm:z.literal(true),acknowledgeBalance:z.boolean().optional()});

/**
 * Deletes the signed-in customer's account (App Store and Google Play both require it in the app).
 * Refused while paid orders are still in progress (err_41) or, with a balance left, until the customer
 * acknowledges losing it (err_43). Replies with the session cookie cleared.
 */
export async function POST(request:Request){try{
 sameOrigin(request);
 const user=await identity();
 await rateLimit(`${user.userId}:account-delete`,5,60*60_000,'err_44');
 const payload=schema.safeParse(await requestJson(request,2000));
 if(!payload.success)throw new HttpError(400,'err_42');
 const current=await account(user);
 if(deletionBlockers(current.state).length)throw new HttpError(409,'err_41');
 if(balanceOf(current.state)>0&&!payload.data.acknowledgeBalance)throw new HttpError(400,'err_43');
 const result=await deleteAccount(user,current.state);
 const response=json({deleted:true,orders:result.summary.orders.total});
 response.headers.append('Set-Cookie',await endSession(request));
 return response;
}catch(error){return failure(error,request)}}
