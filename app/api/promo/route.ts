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
  if(!body.success)throw new HttpError(400,'err_86');
  let rule;
  try{rule=await findPromo(database(),body.data.code)}catch(error){console.error('Promo code read failed',error);throw new HttpError(503,'err_91')}
  const problem=promoProblem(rule,Date.now());
  if(problem||!rule)throw new HttpError(problem==='err_86'||!rule?404:409,problem??'err_86');
  return json({promo:promoPreview(rule)});
}catch(error){return failure(error,request)}}
