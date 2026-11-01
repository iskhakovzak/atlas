import {z} from 'zod';
import {database,identity,sameOrigin,requestJson,json,failure,HttpError,rateLimit} from '@/lib/market/server';
import {promoPreview,promoProblem} from '@/lib/market/promo';
import {findPromo} from '@/lib/market/promo-store';

/**
 * The checkout page asks whether a promo code exists and may be used now (redesign stage 6). Signed-in customers only,
 * a few tries a minute (codes are not guessed by brute force). The answer is the public part of the code; the minimum
 * order is compared by the page with its cart, and the server checks everything again when the order is placed.
 */
export async function POST(request:Request){try{
  sameOrigin(request);
  const user=await identity();
  await rateLimit(`${user.userId}:promo-check`,20,10*60_000);
  const body=z.object({code:z.string().trim().min(1).max(40)}).safeParse(await requestJson(request,2000));
  if(!body.success)throw new HttpError(400,'err_87');
  let rule;
  // The customer sees a plain «temporarily unavailable» (err_95); the migration hint (err_92) is for the admin only.
  try{rule=await findPromo(database(),body.data.code)}catch(error){console.error('Promo code read failed',error);throw new HttpError(503,'err_95')}
  // One answer for every code that cannot be used now (unknown, off, outside its dates, used up): trying codes here tells
  // nothing about which ones exist. The exact reason is given only at payment, for a code this check accepted.
  if(promoProblem(rule,Date.now())||!rule)throw new HttpError(404,'err_87');
  return json({promo:promoPreview(rule)});
}catch(error){return failure(error,request)}}
