'use client';
import {useState} from 'react';
import {BadgeCheck,RotateCw} from 'lucide-react';
import {X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import type {Product} from '@/lib/market/domain';
import type {MerchantFind} from '@/lib/market/catalog';
import {useMarket} from '@/lib/market/store';
import {productDetailCopy} from '@/lib/market/product-detail-copy';
import type {Locale} from '@/lib/market/i18n';
import {ProductOrder} from './global-link-order';
import {useSheetSide} from './use-sheet-side';
import {useSwipeClose} from './use-swipe-close';
import {PhotoWait} from './product-gallery';
import {SumHero} from './product-detail';
import {useFullCatalogProduct} from '@/lib/market/catalog-product-client';
import {sizedImage} from '@/lib/market/image-size';
import {departmentLabel,displayBrand,productTitle} from '@/lib/market/product-name';
import {brandForHost,storefrontLabel} from '@/lib/market/store-brands';
import {officialBadgeLabel,officialListing,officialStoreText} from '@/lib/market/official-stores';
import {uzText} from '@/lib/market/uz-cyrl';
import {StoreBadge} from './store-logo';
import {productPath} from '@/lib/market/catalog-links';
// Styles of this lazily loaded part: they arrive with its chunk, before it renders. The product page is the link
// page's component, so its rules come along (vite.config.ts gives the file its own chunk, named as on the server).
import './styles/link-pages.css';
import './styles/catalog-cards.css';

/**
 * A catalog product opened from a card (redesign stage 5, 1 November 2026): the same product page as /catalog/p/[id] and
 * /order-by-link — photos, one big sum, colours and sizes chosen here, "Из чего сумма" and "В корзину" — in a bottom
 * sheet of 92 % of the screen on phones and a wide panel (photos 7 : details 5) on computers. Opened from a cart line
 * (the cart, the checkout summary), `variant` is that line's option: it opens already chosen.
 */
export function ProductSheet({product,variant,onClose}:{product:Product|null;variant?:string;onClose:()=>void}){
  const side=useSheetSide();
  const swipe=useSwipeClose(onClose);
  const {state}=useMarket();
  const t=productDetailCopy[state.communication.language as Locale];
  // The product stays on the sheet while it slides away (×, swipe, Escape or Back all close it the same way): without
  // it the sheet emptied at once and seemed to vanish (owner, 2 November 2026). A newly opened product replaces it.
  const [shown,setShown]=useState(product);
  if(product&&product!==shown)setShown(product);
  const view=product??shown;
  // A catalog list card has no options, photos or description (lib/market/catalog-summary.ts): the full product is
  // asked when the sheet opens, and the sheet shows the card's photo, name and a placeholder in the page's shape meanwhile.
  const {full,failed,retry}=useFullCatalogProduct(view as MerchantFind|null);
  return <Sheet open={!!product} onOpenChange={open=>{if(!open)onClose()}}>
    {/* Focus goes to the sheet itself, not the "×": a ring on the close button was the first thing seen on every open. */}
    <SheetContent side={side} showCloseButton={false} className={'product-sheet pd-sheet product-sheet-'+side} onOpenAutoFocus={event=>{event.preventDefault();(event.currentTarget as HTMLElement|null)?.focus({preventScroll:true})}}>
      {side==='bottom'&&<span className="sheet-handle" aria-hidden="true" {...swipe}/>}
      {view&&<>
        <SheetTitle className="sr-only">{view.name}</SheetTitle>
        <SheetDescription className="sr-only">{view.brand}</SheetDescription>
        {/* "×" rides a zero-height sticky bar over the photo, still in reach once the details are scrolled. */}
        <div className="pd-sheet-actions"><SheetClose asChild><button type="button" className="icon-btn sheet-close" aria-label={t.close}><X size={20}/></button></SheetClose></div>
        {full
          ? <ProductOrder key={view.id+(view.sourceUrl??'')+'|'+(variant??'')} mode="catalog" product={full as MerchantFind} chosenVariant={variant} inSheet/>
          : <ProductWaiting product={view} failed={failed} retry={retry} locale={state.communication.language as Locale}/>}
      </>}
    </SheetContent>
  </Sheet>;
}

/**
 * The sheet while the full product loads (3 November 2026): the product page's own frame — the photo band, brand,
 * name, the sum's placeholder — so nothing moves when the page replaces it. The card's photo is asked at the gallery's
 * size, so the gallery then finds it in the browser cache. A failed load says so, with a retry and the product's page.
 */
function ProductWaiting({product,failed,retry,locale}:{product:Product;failed:boolean;retry:()=>void;locale:Locale}){
  const t=productDetailCopy[locale];
  const [photoReady,setPhotoReady]=useState(false);
  const title=productTitle(product.name,product.brand);
  // The brand line and the official-store line as the product page writes them (app/global-link-order.tsx), from the
  // list card's own fields, so the name does not move down when the page arrives.
  let host='';try{host=product.sourceUrl?new URL(product.sourceUrl).hostname.replace(/^www./,''):''}catch{/* no store address */}
  const storeName=host?storefrontLabel(host,locale):'',hostBrand=host?brandForHost(host):undefined;
  const brandShown=displayBrand(product.brand,storeName,hostBrand?.focus==='marketplace'?hostBrand.name:undefined);
  const department=(()=>{const text=departmentLabel(product as MerchantFind,locale==='ru'||locale==='en'?locale:'uz');return locale==='oz'?uzText(locale,text):text})();
  const brandLine=[brandShown&&brandShown!==storeName?brandShown:'',storeName,department].filter(Boolean).join(' · ');
  const officialMark=host?officialListing({...product,store:host},hostBrand):undefined;
  const officialOnMarketplace=officialMark&&hostBrand?.focus==='marketplace'?officialMark:undefined;
  const plateBrand=(officialOnMarketplace?brandForHost(officialOnMarketplace):undefined)??hostBrand;
  return <div className="lo-page lo-page-loaded pd-page pd-in-sheet pd-waiting" aria-busy={!failed}>
    <div className="pd">
      <div className="pd-media"><div className="pd-gallery"><div className="product-gallery product-gallery-compact"><div className="product-gallery-frame"><div className="product-gallery-stage">
        <div className={'product-gallery-slide'+(photoReady?'':' is-loading')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.image&&<img className="product-img" src={sizedImage(product.image,960)} alt="" fetchPriority="high" decoding="async" referrerPolicy="no-referrer" draggable={false} ref={image=>{if(image?.complete&&image.naturalWidth)setPhotoReady(true)}} onLoad={()=>setPhotoReady(true)} onError={()=>setPhotoReady(true)}/>}
          {!photoReady&&<PhotoWait label={t.loadingProduct}/>}
        </div>
      </div></div></div></div></div>
      <div className="pd-info">
        <div className="pd-head">
          {(brandLine||plateBrand)&&<p className="pd-brand">{plateBrand&&<StoreBadge brand={plateBrand} size={28} official={Boolean(officialMark)} officialLabel={officialBadgeLabel(locale)}/>}<span>{brandLine}</span></p>}
          {officialOnMarketplace&&<p className="pd-official"><BadgeCheck size={15} aria-hidden="true"/>{officialStoreText(officialOnMarketplace,locale).full}</p>}
          <div className="pd-name-row"><h2 className="pd-title">{title}</h2></div>
          {failed
            ? <div className="pd-waiting-failed" role="alert"><p>{t.loadFailed}</p><p><button type="button" className="btn secondary" onClick={retry}><RotateCw size={16} aria-hidden="true"/>{t.retry}</button> <a className="text-link" href={productPath(product.id)}>{t.openPage}</a></p></div>
            : <><SumHero total={null} pending locale={locale}/><span className="sr-only" role="status">{t.loadingProduct}</span><p className="pd-usd"><span className="lo-skel lo-skel-price" aria-hidden="true"/></p></>}
        </div>
        {!failed&&<div className="pd-waiting-pick" aria-hidden="true"><span className="lo-skel"/><span className="lo-skel"/><span className="lo-skel"/></div>}
      </div>
    </div>
  </div>;
}
