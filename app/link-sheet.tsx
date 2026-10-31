'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,Link2,ListPlus,Loader2,Search,Store,X} from 'lucide-react';
import Link from '@/components/site-link';
import {PasteButton} from '@/components/paste-button';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle} from '@/components/ui/sheet';
import {validateSource} from '@/lib/market/domain';
import {looksLikeLink,normalizeProductLink} from '@/lib/market/shared-link';
import {startNavigationFeedback} from '@/lib/market/navigation-feedback';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import type {Locale} from '@/lib/market/i18n';
import {useClipboardLink} from './use-clipboard-link';
import './link-sheet.css';

const copy=/*@__PURE__*/withCyrillic({
  ru:{title:'Купить по ссылке',lead:'Вставьте ссылку на товар из зарубежного магазина — покажем счёт в сумах ещё до оплаты.',label:'Ссылка на товар',placeholder:'https://…',calculate:'Рассчитать',close:'Закрыть',invalid:'Вставьте полную ссылку на страницу товара — она начинается с https://',notLink:'Это не ссылка на товар. Откройте товар в магазине, скопируйте адрес страницы и вставьте сюда.',search:(q:string)=>`Найти «${q}» в каталоге`,stores:'Все магазины',batch:'Несколько ссылок сразу'},
  uz:{title:'Havola orqali xarid',lead:'Xorijiy do‘kondagi tovar havolasini qo‘ying — to‘lovdan oldin so‘mdagi hisobni ko‘rsatamiz.',label:'Tovar havolasi',placeholder:'https://…',calculate:'Hisoblash',close:'Yopish',invalid:'Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi',notLink:'Bu tovar havolasi emas. Tovarni do‘konda oching, sahifa manzilini nusxalab, shu yerga qo‘ying.',search:(q:string)=>`Katalogda «${q}» ni topish`,stores:'Barcha do‘konlar',batch:'Bir nechta havola birdaniga'},
  en:{title:'Buy by link',lead:'Paste a product link from a store abroad — we show the bill in soums before you pay.',label:'Product link',placeholder:'https://…',calculate:'Calculate',close:'Close',invalid:'Paste the full product page link — it starts with https://',notLink:'This is not a product link. Open the item in the store, copy the page address and paste it here.',search:(q:string)=>`Find “${q}” in the catalog`,stores:'All stores',batch:'Several links at once'},
});

/**
 * The bottom bar's centre button opens this sheet on every page (app/marketplace.tsx): the link field with "Вставить",
 * lit while a store link is in the clipboard (app/use-clipboard-link.ts), and "Рассчитать", which opens the usual
 * order-by-link calculation (/order-by-link?url=…). A pasted store link opens it at once, as on the home page.
 * Its own chunk, loaded on the first tap.
 */
export function LinkSheet({open,onOpenChange,locale,member}:{open:boolean;onOpenChange:(open:boolean)=>void;locale:Locale;member:boolean}){
  const c=copy[locale];
  const router=useRouter();
  const [url,setUrl]=useState('');
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const clip=useClipboardLink(undefined,open);
  const input=useRef<HTMLInputElement>(null);
  // Closing leaves the next opening clean (the typed link stays, in case it is wanted again).
  const change=(next:boolean)=>{if(!next){setError('');setSearch('');setBusy(false)}onOpenChange(next)};
  function go(value:string){
    const raw=value.trim();
    let target:string;
    try{target=validateSource(normalizeProductLink(raw)||raw)}
    catch{
      const words=Boolean(raw)&&!looksLikeLink(raw);
      setError(words?c.notLink:c.invalid);setSearch(words?raw.slice(0,60):'');
      return;
    }
    setError('');setSearch('');setBusy(true);
    const href='/order-by-link?url='+encodeURIComponent(target);
    // Already on the order page: a full load, as SiteLink does for the same page with another query.
    if(window.location.pathname==='/order-by-link'){window.location.assign(href);return}
    startNavigationFeedback();
    router.push(href);
    change(false);
  }
  function submit(event:FormEvent){event.preventDefault();go(url)}
  function pasted(text:string){
    setUrl(text);setError('');setSearch('');
    try{validateSource(normalizeProductLink(text.trim())||text.trim())}catch{return}
    go(text);
  }
  return <Sheet open={open} onOpenChange={change}>
    <SheetContent side="bottom" showCloseButton={false} className="link-sheet" onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus({preventScroll:true})}}>
      <div className="link-sheet-grip" aria-hidden="true"/>
      <div className="link-sheet-head">
        <span className="link-sheet-mark" aria-hidden="true"><Link2 size={20}/></span>
        <div><SheetTitle className="link-sheet-title">{c.title}</SheetTitle><SheetDescription className="link-sheet-lead">{c.lead}</SheetDescription></div>
        <SheetClose className="link-sheet-close" aria-label={c.close}><X size={20} aria-hidden="true"/></SheetClose>
      </div>
      <form className="link-sheet-form" onSubmit={submit} noValidate>
        <label className="sr-only" htmlFor="link-sheet-url">{c.label}</label>
        <span className="link-sheet-field">
          <input ref={input} id="link-sheet-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.placeholder} aria-invalid={!!error} aria-describedby={error?'link-sheet-error':undefined}
            onChange={event=>{setUrl(event.target.value);setError('');setSearch('')}}
            onPaste={event=>{const text=event.clipboardData.getData('text');if(!text.trim())return;event.preventDefault();pasted(text)}}/>
          <PasteButton targetId="link-sheet-url" locale={locale} disabled={busy} ready={clip.ready} onPaste={text=>{clip.used();pasted(text)}}/>
        </span>
        <button type="submit" className="btn primary link-sheet-submit" aria-busy={busy||undefined} disabled={busy}>{busy?<Loader2 className="spin" size={20} aria-hidden="true"/>:null}<span>{c.calculate}</span>{!busy&&<ArrowRight size={18} aria-hidden="true"/>}</button>
      </form>
      {error&&<p id="link-sheet-error" className="link-sheet-error" role="alert">{error}</p>}
      {search&&<Link className="btn secondary link-sheet-search" href={'/catalog?q='+encodeURIComponent(search)} onClick={()=>change(false)}><Search size={16} aria-hidden="true"/>{c.search(search)}</Link>}
      <nav className="link-sheet-more" aria-label={c.title}>
        <Link href="/stores" onClick={()=>change(false)}><Store size={18} aria-hidden="true"/><span>{c.stores}</span><ArrowRight size={16} aria-hidden="true"/></Link>
        {member&&<Link href="/batch-import" onClick={()=>change(false)}><ListPlus size={18} aria-hidden="true"/><span>{c.batch}</span><ArrowRight size={16} aria-hidden="true"/></Link>}
      </nav>
    </SheetContent>
  </Sheet>;
}
