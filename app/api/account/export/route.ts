import {account,database,failure,identity,rateLimit} from '@/lib/market/server';
import {ownMethod} from '@/lib/auth/core';
import {accountExportFilename,buildAccountExport,type ExportConsentRow,type ExportOrderDocumentRow,type ExportPassportRow,type ExportPromoRow,type ExportPushRow} from '@/lib/market/account-export';

// Tables from later migrations (0008 links, 0015 push, 0017 promo codes) may be missing on an older database.
async function rows<T>(sql:string,...binds:unknown[]):Promise<T[]>{
 try{return (await database().prepare(sql).bind(...binds).all<T>()).results??[]}catch{return []}
}

/**
 * «Скачать мои данные»: the signed-in customer's own data as a JSON download (lib/market/account-export.ts decides
 * what goes in). Only the session's account, never anyone else's; 5 downloads an hour; no CORS headers, not cached.
 */
export async function GET(request:Request){try{
 const user=await identity();
 await rateLimit(`${user.userId}:account-export`,5,60*60_000,'err_97');
 const id=user.userId,now=Date.now();
 const [current,links,consents,passports,orderDocuments,promoUses,pushSubscriptions]=await Promise.all([
  account(user),
  rows<{method:string;contact:string;created_at:number}>('SELECT method,contact,created_at FROM market_auth_links WHERE user_id=? ORDER BY created_at',id),
  rows<ExportConsentRow>('SELECT document_key,document_version,accepted_at FROM market_legal_consents WHERE customer_id=? ORDER BY accepted_at',id),
  rows<ExportPassportRow>('SELECT id,status,filename,created_at FROM market_identity_documents WHERE user_id=? ORDER BY created_at',id),
  rows<ExportOrderDocumentRow>('SELECT id,order_id,kind,filename,content_type,size,created_at FROM market_order_documents WHERE customer_id=? ORDER BY created_at',id),
  rows<ExportPromoRow>('SELECT code,order_ids,discount,created_at,returned_at FROM market_promo_redemptions WHERE user_id=? ORDER BY created_at',id),
  rows<ExportPushRow>('SELECT endpoint,created_at FROM market_push_subscriptions WHERE user_id=? ORDER BY created_at',id),
 ]);
 const own=ownMethod(id);
 const body=buildAccountExport({
  profile:{userId:id,name:current.name,email:user.email,contact:user.contact,method:user.method,createdAt:current.created_at},
  state:current.state,
  signInMethods:[{...own,own:true},...links.map(row=>({method:row.method,contact:row.contact,createdAt:row.created_at}))],
  consents,passports,orderDocuments,promoUses,pushSubscriptions,now,
 });
 return new Response(JSON.stringify(body,null,2),{headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Content-Disposition':`attachment; filename="${accountExportFilename(now)}"`,
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
 }});
}catch(error){return failure(error,request)}}
