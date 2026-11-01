'use client';
import {useState} from 'react';
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
// Styles of this lazily loaded part: they arrive with its chunk, before it renders. The product page is the link
// page's component, so its rules come along (vite.config.ts gives the file its own chunk, named as on the server).
import './styles/link-pages.css';
import './styles/catalog-cards.css';

/**
 * A catalog product opened from a card (redesign stage 5, 1 November 2026): the same product page as /catalog/p/[id] and
 * /order-by-link — photos, one big sum, colours and sizes chosen here, "Из чего сумма" and "В корзину" — in a bottom
 * sheet of 92 % of the screen on phones and a wide panel (photos 7 : details 5) on computers.
 */
export function ProductSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  const side=useSheetSide();
  const swipe=useSwipeClose(onClose);
  const {state}=useMarket();
  const t=productDetailCopy[state.communication.language as Locale];
  // The product stays on the sheet while it slides away (×, swipe, Escape or Back all close it the same way): without
  // it the sheet emptied at once and seemed to vanish (owner, 2 November 2026). A newly opened product replaces it.
  const [shown,setShown]=useState(product);
  if(product&&product!==shown)setShown(product);
  const view=product??shown;
  return <Sheet open={!!product} onOpenChange={open=>{if(!open)onClose()}}>
    {/* Focus goes to the sheet itself, not the "×": a ring on the close button was the first thing seen on every open. */}
    <SheetContent side={side} showCloseButton={false} className={'product-sheet pd-sheet product-sheet-'+side} onOpenAutoFocus={event=>{event.preventDefault();(event.currentTarget as HTMLElement|null)?.focus({preventScroll:true})}}>
      {side==='bottom'&&<span className="sheet-handle" aria-hidden="true" {...swipe}/>}
      {view&&<>
        <SheetTitle className="sr-only">{view.name}</SheetTitle>
        <SheetDescription className="sr-only">{view.brand}</SheetDescription>
        {/* "×" rides a zero-height sticky bar over the photo, still in reach once the details are scrolled. */}
        <div className="pd-sheet-actions"><SheetClose asChild><button type="button" className="icon-btn sheet-close" aria-label={t.close}><X size={20}/></button></SheetClose></div>
        <ProductOrder key={view.id+(view.sourceUrl??'')} mode="catalog" product={view as MerchantFind} inSheet/>
      </>}
    </SheetContent>
  </Sheet>;
}
