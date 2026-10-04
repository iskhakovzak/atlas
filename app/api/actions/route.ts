import {actionSchema,applyAction} from '@/lib/market/actions';
import {account,customerStatus,database,identity,operator,sameOrigin,persist,json,failure,HttpError,requestJson,pricingAndPolicy,deferBackground} from '@/lib/market/server';
import {apiErrorMessage,requestLocale,serverError} from '@/lib/market/i18n';
import {fetchProduct} from '@/lib/importer/fetch';
import {merchantRequest} from '@/lib/importer/worker-fetch';
import {manualFallbackAllowed,requiresMerchantSnapshot} from '@/lib/importer/manual-fallback';
import {compareProductSnapshot} from '@/lib/importer/verify';
import {checkCartSources,recentCheckMs} from '@/lib/market/cart-check';
import {cartSignature,renewCart,type State} from '@/lib/market/domain';
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
  let next:State;
  let verifiedSource:Awaited<ReturnType<typeof fetchProduct>>|undefined;
  // Set when the cart was repriced (new store price, new tariff, a product to load again): the new cart is
  // saved and shown, and the action itself is refused, so an old total never passes unnoticed.
  let refusal:string|undefined;
  try{
    const {pricing:currentPricing,policy:currentPolicy}=await pricingAndPolicy();
    const action=parsed.data,now=Date.now();
    let state=current.state;
    if(action.type==='cart-add'){
      // Only the server records when a product was last checked against the store.
      action.product.sourceCheckedAt=undefined;
      if(action.product.sourceUrl&&requiresMerchantSnapshot(action.product)){
        try{verifiedSource=await fetchProduct(action.product.sourceUrl,merchantRequest)}
        catch(error){if(!manualFallbackAllowed(action.product,action.variant,error))throw error}
        if(verifiedSource){
          const check=compareProductSnapshot(action.product,action.variant,verifiedSource,now);
          if(check.status==='blocked')throw Error(check.message);
          // The page showed an older price: the customer reloads it and sees the new total before adding.
          if(check.status==='changed')throw new HttpError(409,'err_34');
          action.product=check.product;
        }
      }
    }
    if(action.type==='cart-check'||action.type==='checkout'){
      const checked=await checkCartSources(state.cart,url=>fetchProduct(url,merchantRequest),currentPricing,now,recentCheckMs);
      state={...state,cart:checked.cart};
      const tariffChanged=state.cart.some(item=>item.quote.tariffVersion!==currentPricing.version);
      const unreachableOnly=checked.blocked.length>0&&checked.blocked.every(id=>state.cart.find(item=>item.id===id)?.sourceIssue?.kind==='unreachable');
      refusal=checked.blocked.length?(unreachableOnly?'err_38':'err_36'):checked.changed.length?'err_35':tariffChanged?'err_37':undefined;
      if(refusal)state=renewCart(state,now,currentPricing);
      else if(action.type==='checkout'&&state.cart.some(item=>now>=item.quote.expiresAt)){
        // Only the 15-minute hold ran out: with the same amounts the customer already saw, go on.
        const renewed=renewCart(state,now,currentPricing);
        const sameTotals=renewed.cart.every((item,index)=>item.quote.total===state.cart[index].quote.total);
        if(!sameTotals)refusal='err_37';
        else if(action.signature===cartSignature(state.cart))action.signature=cartSignature(renewed.cart);
        state=renewed;
      }
    }
    next=refusal?state:applyAction(state,action,operator(user.email),currentPricing,currentPolicy);
  }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,(e as Error).message)}
  await persist(user.userId,next,current.revision);
  if(refusal)return json({error:serverError(requestLocale(request),refusal),errorCode:refusal,state:next,revision:current.revision+1},409);
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
