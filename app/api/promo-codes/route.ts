import {z} from 'zod';
import {database,identity,requirePermission,sameOrigin,requestJson,json,failure,HttpError,recordAudit} from '@/lib/market/server';
import {promoInputSchema} from '@/lib/market/promo';
import {listPromos,savePromo} from '@/lib/market/promo-store';

/**
 * Promo codes for the admin («Промокоды», redesign stage 6): the list with uses and the discount given, and saving one.
 * Staff who manage tariffs and services (pricing.manage; the administrator holds every right) — the same people who set
 * the Atlas fee the codes lower. Every save goes to the audit log. Before migration 0017 the answer is err_91.
 */
async function promos(){try{return await listPromos(database())}catch(error){console.error('Promo codes read failed',error);throw new HttpError(503,'err_91')}}

export async function GET(request:Request){try{
  const user=await identity();await requirePermission(user,'pricing.manage');
  return json({promos:await promos()});
}catch(error){return failure(error,request)}}

export async function POST(request:Request){try{
  sameOrigin(request);
  const user=await identity();await requirePermission(user,'pricing.manage');
  const parsed=z.object({promo:promoInputSchema}).safeParse(await requestJson(request,8000));
  if(!parsed.success)throw new HttpError(400,'err_92');
  let saved;
  try{saved=await savePromo(database(),parsed.data.promo,user.email||user.userId)}catch(error){console.error('Promo code save failed',error);throw new HttpError(503,'err_91')}
  if(!saved)throw new HttpError(409,'err_93');
  await recordAudit(user,parsed.data.promo.id?'promo.update':'promo.create','promo',saved.id,{code:saved.code,kind:saved.kind,value:saved.value,active:saved.active,maxUses:saved.maxUses??null,minOrder:saved.minOrder??null,startsAt:saved.startsAt??null,endsAt:saved.endsAt??null});
  return json({promo:saved,promos:await promos()});
}catch(error){return failure(error,request)}}
