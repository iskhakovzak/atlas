import {z} from 'zod';
import {database,identity,requirePermission,sameOrigin,requestJson,json,failure,HttpError,recordAudit} from '@/lib/market/server';
import {serverError,requestLocale} from '@/lib/market/i18n';
import {siteContentDocumentSchema,parseStoredSiteContent,mergeSiteContent,siteContentIssues,siteContentStorageKey,type SiteContentDocument} from '@/lib/market/site-content-schema';

/**
 * The site content document (contacts, legal entity, payment methods, reviews, parcel photos, completed
 * orders, prohibited-goods link). Stored in market_settings under 'site-content' as JSON with a CAS
 * `revision`, like the catalog: a save with a stale revision is refused (409) and returns the current
 * document instead of overwriting it. The first render reads the same row (lib/market/initial-data.ts).
 */
async function readStored(){
  const row=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(siteContentStorageKey).first<{value:string}>();
  return {raw:row?.value??null,document:parseStoredSiteContent(row?.value)};
}

/** Public: the merged document the pages render (also what the admin form edits). */
export async function GET(request:Request){try{
  const {document}=await readStored();
  return json({document:mergeSiteContent(document)});
}catch(error){return failure(error,request)}}

export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity();await requirePermission(user,'content.manage');
  const envelope=z.object({revision:z.number().int().nonnegative(),document:z.unknown()}).safeParse(await requestJson(request,300000));
  if(!envelope.success)throw new HttpError(400,'err_30');
  const locale=requestLocale(request);
  const parsed=siteContentDocumentSchema.safeParse(envelope.data.document);
  if(!parsed.success)return json({error:serverError(locale,'err_53'),errorCode:'err_53',issues:siteContentIssues(parsed.error)},400);
  const current=await readStored();
  if(current.document.revision!==envelope.data.revision)return json({error:serverError(locale,'err_52'),errorCode:'err_52',document:mergeSiteContent(current.document)},409);
  const now=Date.now();
  const next:SiteContentDocument={...parsed.data,revision:current.document.revision+1,updatedAt:now};
  const value=JSON.stringify(next);
  if(new TextEncoder().encode(value).length>200_000)throw new HttpError(413,'Документ контента слишком большой. Сократите отзывы или список фото.');
  const db=database();
  // CAS on the stored text: a concurrent save between the read above and this write loses with 409, never overwrites.
  const result=current.raw===null
    ?await db.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO NOTHING').bind(siteContentStorageKey,value,now,user.userId).run()
    :await db.prepare('UPDATE market_settings SET value=?,updated_at=?,updated_by=? WHERE key=? AND value=?').bind(value,now,user.userId,siteContentStorageKey,current.raw).run();
  if(!result.meta.changes){const fresh=await readStored();return json({error:serverError(locale,'err_52'),errorCode:'err_52',document:mergeSiteContent(fresh.document)},409);}
  await recordAudit(user,'site-content.save','settings','site-content',{
    revision:next.revision,
    contacts:Object.entries(next.contacts).filter(([,v])=>v!=null).map(([k])=>k),
    legal:Object.entries(next.legal).filter(([,v])=>v!=null).map(([k])=>k),
    paymentMethods:next.paymentMethods,reviews:next.reviews.length,parcelPhotos:next.parcelPhotos.length,
    completedOrders:next.completedOrders,prohibitedListUrl:next.prohibitedListUrl,
  });
  return json({document:mergeSiteContent(next)});
}catch(error){return failure(error,request)}}
