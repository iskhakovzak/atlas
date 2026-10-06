import {actionSchema} from '@/lib/market/actions';
import {account,customerStatus,database,identity,operator,sameOrigin,persist,json,failure,HttpError,rateLimit,requestJson,pricingAndPolicy,deferBackground} from '@/lib/market/server';
import {apiErrorMessage,requestLocale,serverError} from '@/lib/market/i18n';
import {fetchProduct} from '@/lib/importer/fetch';
import {merchantRequest} from '@/lib/importer/worker-fetch';
import {recentCheckMs} from '@/lib/market/cart-check';
import {codedActionError,editorialShippingFor,prepareAction,staleRevision,type EditorialShipping,type PreparedAction} from '@/lib/market/actions-server';
import {catalogDocumentSchema,initialCatalog,synchronizeBundledCatalog,type CatalogDocument} from '@/lib/market/catalog-editor';
import type {Product,State} from '@/lib/market/domain';
import {addCustomerLinkDraft} from '@/lib/market/catalog-server';
/**
 * The catalog's delivery record for a product link, read once per request and only when an action needs it.
 * Read-only: the bundled cards are merged in memory, nothing is written. Without the stored catalog
 * (or when it cannot be read) the bundled cards and community deals still count.
 */
function editorialShippingLookup(){
  let document:Promise<CatalogDocument>|undefined;
  const load=async()=>{
    let stored:CatalogDocument|undefined;
    try{
      const row=await database().prepare("SELECT value FROM market_settings WHERE key='catalog'").first<{value:string}>();
      if(row)stored=catalogDocumentSchema.parse(JSON.parse(row.value));
    }catch(error){console.error('Catalog read for store delivery failed',error)}
    return synchronizeBundledCatalog(stored??initialCatalog()).document;
  };
  return async(product:Pick<Product,'sourceUrl'>):Promise<EditorialShipping|undefined>=>{
    if(!product.sourceUrl)return undefined;
    document??=load();
    return editorialShippingFor(await document,product.sourceUrl);
  };
}
export async function POST(request:Request){try{
  sameOrigin(request);
  const user=await identity();
  const payload=await requestJson(request) as {action:unknown;revision:number};
  const parsed=actionSchema.safeParse(payload.action);
  if(!parsed.success)throw new HttpError(400, 'err_10');
  // Every action writes the account; adding to the cart and checking it also ask the stores through the proxy.
  await rateLimit(`${user.userId}:actions`,60,60_000);
  if(['cart-add','cart-add-many','cart-check','checkout'].includes(parsed.data.type))await rateLimit(`${user.userId}:store-checks`,40,10*60_000,'err_39');
  // Independent reads go out together: one D1 round trip instead of three in a row on every action.
  const [status,current,settings]=await Promise.all([customerStatus(user.userId),account(user),pricingAndPolicy()]);
  if(status==='blocked')throw new HttpError(403, 'err_11');
  if(status==='review'&&['checkout','payment-demo'].includes(parsed.data.type))throw new HttpError(403, 'err_12');
  if(parsed.data.type==='identity-confirm'){
    const identityAction=parsed.data;
    const owned=await database().prepare('SELECT id FROM market_identity_documents WHERE id=? AND user_id=?').bind(identityAction.documentId,user.userId).first();
    if(!owned)throw new HttpError(404, 'err_13');
    if(identityAction.recipientProfileId&&!current.state.deliveryProfiles.some(profile=>profile.id===identityAction.recipientProfileId))throw new HttpError(400, 'err_14');
  }
  if(staleRevision(payload.revision,current.revision)){const locale=requestLocale(request);return json({error:locale==='ru'?'Данные изменились. Проверьте обновлённый заказ и повторите действие.':apiErrorMessage(409,locale),state:current.state,revision:current.revision},409)}
  let next:State;
  let verifiedSource:PreparedAction['verifiedSource'];
  // Set when the cart was repriced (new store price, new tariff, a product to load again): the new cart is
  // saved and shown, and the action itself is refused, so an old total never passes unnoticed.
  let refusal:string|undefined;
  try{
    const {pricing,policy}=settings;
    ({next,refusal,verifiedSource}=await prepareAction(current.state,parsed.data,{fetchProduct:url=>fetchProduct(url,merchantRequest),pricing,policy,operator:operator(user.email),now:Date.now(),recentCheckMs,editorialShipping:editorialShippingLookup()}));
  }catch(e){
    if(e instanceof HttpError)throw e;
    const coded=codedActionError(e);
    if(coded)throw new HttpError(coded.status,coded.code);
    throw new HttpError(400,(e as Error).message)
  }
  await persist(user.userId,next,current.revision);
  if(refusal)return json({error:serverError(requestLocale(request),refusal),errorCode:refusal,state:next,revision:current.revision+1},409);
  const addedProduct=parsed.data.type==='cart-add'?parsed.data.product:parsed.data.type==='cart-add-many'?parsed.data.items[0].product:undefined;
  if(addedProduct?.sourceUrl&&verifiedSource){
    deferBackground(addCustomerLinkDraft(addedProduct,verifiedSource,user),'Customer catalog draft sync failed');
  }
  if(parsed.data.type==='identity-confirm'){
    const identityAction=parsed.data;
    const confirmed=next.identityProfiles?.find(profile=>profile.documentId===identityAction.documentId)??next.identityProfile;
    await database().prepare('UPDATE market_identity_documents SET status=?, confirmed_data=?, updated_at=? WHERE id=? AND user_id=?').bind('confirmed',JSON.stringify(confirmed),Date.now(),identityAction.documentId,user.userId).run();
  }
  if(parsed.data.type==='consent-accept'){
    // Proof of consent outside the account document (migration 0004); kept, pseudonymised, after the account is deleted.
    const consent=parsed.data,acceptedAt=Date.now(),db=database();
    const rows=consent.documents.map(key=>db.prepare('INSERT OR IGNORE INTO market_legal_consents (id,customer_id,document_key,document_version,accepted_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,key,consent.version,acceptedAt));
    try{await db.batch(rows)}catch(error){console.error('Legal consent record failed',error)}
  }
  return json({state:next,revision:current.revision+1})
}catch(e){return failure(e,request)}}
