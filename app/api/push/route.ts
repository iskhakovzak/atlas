import {identity,sameOrigin,requestJson,json,failure,HttpError} from '@/lib/market/server';
import {deletePushSubscription,pushKeys,savePushSubscription,validPushSubscription} from '@/lib/market/push-server';

// Browser notifications (lib/market/push-server.ts). GET: the site's public VAPID key, or null while push is off.
// POST: this browser's subscription for the signed-in account. DELETE: turn this browser off.
export async function GET(request:Request){try{await identity();return json({publicKey:pushKeys()?.publicKey??null})}catch(error){return failure(error,request)}}

export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity();
  if(!pushKeys())throw new HttpError(404,'push_off');
  const subscription=validPushSubscription(await requestJson(request,4000));
  if(!subscription)throw new HttpError(400,'push_invalid');
  await savePushSubscription(user.userId,subscription);
  return json({saved:true});
}catch(error){return failure(error,request)}}

export async function DELETE(request:Request){try{
  sameOrigin(request);const user=await identity();
  const body=await requestJson(request,2000) as {endpoint?:unknown};
  if(typeof body?.endpoint!=='string')throw new HttpError(400,'push_invalid');
  await deletePushSubscription(user.userId,body.endpoint);
  return json({deleted:true});
}catch(error){return failure(error,request)}}
