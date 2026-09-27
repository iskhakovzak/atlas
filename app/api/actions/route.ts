import {actionSchema,applyAction} from '@/lib/market/actions';
import {account,customerStatus,database,identity,operator,sameOrigin,persist,json,failure,HttpError,requestJson,pricing,policy,deferBackground} from '@/lib/market/server';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';
import {fetchProduct} from '@/lib/importer/fetch';
import {manualFallbackAllowed} from '@/lib/importer/manual-fallback';
import {verifyProductSnapshot} from '@/lib/importer/verify';
import {addCustomerLinkDraft} from '@/lib/market/catalog-server';
export async function POST(request:Request){try{
  sameOrigin(request);
  const user=await identity();
  const payload=await requestJson(request) as {action:unknown;revision:number};
  const parsed=actionSchema.safeParse(payload.action);
  if(!parsed.success)throw new HttpError(400, 'err_10');
  const status=await customerStatus(user.userId);
  if(status==='blocked')throw new HttpError(403, 'err_11');
  if(status==='review'&&['checkout','payment-demo'].includes(parsed.data.type))throw new HttpError(403, 'err_12');
  const current=await account(user);
  if(parsed.data.type==='identity-confirm'){
    const identityAction=parsed.data;
    const owned=await database().prepare('SELECT id FROM market_identity_documents WHERE id=? AND user_id=?').bind(identityAction.documentId,user.userId).first();
    if(!owned)throw new HttpError(404, 'err_13');
    if(identityAction.recipientProfileId&&!current.state.deliveryProfiles.some(profile=>profile.id===identityAction.recipientProfileId))throw new HttpError(400, 'err_14');
  }
  if(payload.revision!==current.revision){const locale=requestLocale(request);return json({error:locale==='ru'?'Данные изменились. Проверьте обновлённый заказ и повторите действие.':apiErrorMessage(409,locale),state:current.state,revision:current.revision},409)}
  let next;
  let verifiedSource:Awaited<ReturnType<typeof fetchProduct>>|undefined;
  try{
     const [currentPricing,currentPolicy]=await Promise.all([pricing(),policy()]);
     if(parsed.data.type==='cart-add'&&parsed.data.product.sourceUrl){
       try{
         verifiedSource=await fetchProduct(parsed.data.product.sourceUrl);
         parsed.data.product=verifyProductSnapshot(parsed.data.product,parsed.data.variant,verifiedSource);
       }catch(error){
         if(!manualFallbackAllowed(parsed.data.product,parsed.data.variant,error))throw error;
       }
     }
    if(parsed.data.type==='checkout'){
      const grouped=new Map<string,typeof current.state.cart>();
      for(const item of current.state.cart){
        if(!item.product.sourceUrl)continue;
        const key=item.product.sourceUrl,items=grouped.get(key)??[];
        items.push(item);grouped.set(key,items);
      }
       await Promise.all([...grouped.entries()].map(async([url,items])=>{
         try{
           const fresh=await fetchProduct(url);
           for(const item of items)verifyProductSnapshot(item.product,item.variant,fresh);
         }catch(error){
           for(const item of items)if(!manualFallbackAllowed(item.product,item.variant,error))throw error;
         }
       }));
    }
    next=applyAction(current.state,parsed.data,operator(user.email),currentPricing,currentPolicy);
  }catch(e){throw new HttpError(400,(e as Error).message)}
  await persist(user.userId,next,current.revision);
  if(parsed.data.type==='cart-add'&&parsed.data.product.sourceUrl&&verifiedSource){
    deferBackground(addCustomerLinkDraft(parsed.data.product,verifiedSource,user),'Customer catalog draft sync failed');
  }
  if(parsed.data.type==='identity-confirm'){
    const identityAction=parsed.data;
    const confirmed=next.identityProfiles?.find(profile=>profile.documentId===identityAction.documentId)??next.identityProfile;
    await database().prepare('UPDATE market_identity_documents SET status=?, confirmed_data=?, updated_at=? WHERE id=? AND user_id=?').bind('confirmed',JSON.stringify(confirmed),Date.now(),identityAction.documentId,user.userId).run();
  }
  return json({state:next,revision:current.revision+1})
}catch(e){return failure(e,request)}}
