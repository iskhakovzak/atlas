import {actionSchema,applyAction} from '@/lib/market/actions';
import {account,customerStatus,database,identity,operator,sameOrigin,persist,json,failure,HttpError,rateLimit,requestJson,pricingAndPolicy,deferBackground} from '@/lib/market/server';
import {apiErrorMessage,requestLocale,serverError} from '@/lib/market/i18n';
import {fetchProduct} from '@/lib/importer/fetch';
import {merchantRequest} from '@/lib/importer/worker-fetch';
import {manualFallbackAllowed,requiresMerchantSnapshot} from '@/lib/importer/manual-fallback';
import {compareProductSnapshot} from '@/lib/importer/verify';
import {checkCartSources,recentCheckMs} from '@/lib/market/cart-check';
import {cartSignature,customsHelpChosen,renewCart,type State} from '@/lib/market/domain';
import {addCustomerLinkDraft} from '@/lib/market/catalog-server';
import {validBoxedWeight} from '@/lib/market/weight';
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
  if(payload.revision!==current.revision){const locale=requestLocale(request);return json({error:locale==='ru'?'Данные изменились. Проверьте обновлённый заказ и повторите действие.':apiErrorMessage(409,locale),state:current.state,revision:current.revision},409)}
  let next:State;
  let verifiedSource:Awaited<ReturnType<typeof fetchProduct>>|undefined;
  // Set when the cart was repriced (new store price, new tariff, a product to load again): the new cart is
  // saved and shown, and the action itself is refused, so an old total never passes unnoticed.
  let refusal:string|undefined;
  try{
    const {pricing:currentPricing,policy:currentPolicy}=settings;
    const action=parsed.data,now=Date.now();
    let state=current.state;
    if(action.type==='cart-add'||action.type==='cart-add-many'){
      const items=action.type==='cart-add'?[{product:action.product,variant:action.variant}]:action.items;
      // Several options of one product share one request to the store.
      const fetched=new Map<string,Promise<{value?:Awaited<ReturnType<typeof fetchProduct>>;error?:unknown}>>();
      for(const item of items){
        // Only the server records when a product was last checked and how many units the store reports.
        item.product={...item.product,sourceCheckedAt:undefined,stockQuantity:undefined,stockMoreThan:undefined,stockSource:undefined};
        if(!item.product.sourceUrl||!requiresMerchantSnapshot(item.product))continue;
        const url=item.product.sourceUrl;
        let result=fetched.get(url);
        if(!result){result=fetchProduct(url,merchantRequest).then(value=>({value}),error=>({error}));fetched.set(url,result)}
        const {value,error}=await result;
        if(!value){if(!manualFallbackAllowed(item.product,item.variant,error))throw error;continue}
        verifiedSource??=value;
        const check=compareProductSnapshot(item.product,item.variant,value,now);
        if(check.status==='blocked')throw Error(check.message);
        // The page showed an older price: the customer reloads it and sees the new total before adding.
        if(check.status==='changed')throw new HttpError(409,'err_34');
        item.product=check.product;
        // A shipping weight the store publishes is used unless the customer entered their own.
        const storeWeight=value.weightKind==='shipping'?validBoxedWeight(value.boxedWeight):undefined;
        if(storeWeight!==undefined&&item.product.weightBasis!=='customer')item.product={...item.product,boxedWeight:storeWeight,weightBasis:'store'};
      }
      if(action.type==='cart-add')action.product=items[0].product;
    }
    if(action.type==='cart-check'||action.type==='checkout'){
      const checked=await checkCartSources(state.cart,url=>fetchProduct(url,merchantRequest),currentPricing,now,recentCheckMs);
      state={...state,cart:checked.cart};
      // A line priced before the tariff changed, or without (with) the customs fee the customer (no longer) chose.
      const tariffChanged=state.cart.some(item=>item.quote.tariffVersion!==currentPricing.version||Boolean(item.quote.customsHelp)!==customsHelpChosen(state));
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
  const addedProduct=parsed.data.type==='cart-add'?parsed.data.product:parsed.data.type==='cart-add-many'?parsed.data.items[0].product:undefined;
  if(addedProduct?.sourceUrl&&verifiedSource){
    deferBackground(addCustomerLinkDraft(addedProduct,verifiedSource,user),'Customer catalog draft sync failed');
  }
  if(parsed.data.type==='identity-confirm'){
    const identityAction=parsed.data;
    const confirmed=next.identityProfiles?.find(profile=>profile.documentId===identityAction.documentId)??next.identityProfile;
    await database().prepare('UPDATE market_identity_documents SET status=?, confirmed_data=?, updated_at=? WHERE id=? AND user_id=?').bind('confirmed',JSON.stringify(confirmed),Date.now(),identityAction.documentId,user.userId).run();
  }
  return json({state:next,revision:current.revision+1})
}catch(e){return failure(e,request)}}
