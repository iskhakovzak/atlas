'use client';
import {Suspense,lazy,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {AlertTriangle,CheckCircle2,Info,XCircle} from 'lucide-react';
import {loadSonner,toast,toasterHost} from '@/lib/market/toast';
import {toastSurvivesRoute} from '@/lib/market/toast-route';
const Toaster=lazy(()=>loadSonner().then(module=>({default:module.Toaster})));
/** Signals after sonner's Toaster (an earlier sibling) has subscribed: sibling effects run in order. */
function Mounted(){useEffect(()=>toasterHost.mounted(),[]);return null}

const phoneQuery='(max-width: 639px)';
/**
 * Where a toast sits on a phone: above whatever is fixed to the bottom of the screen (the bottom bar, a product's or the
 * cart's sticky total), so it lands under the thumb and covers nothing to press. Written as a CSS variable the toaster's
 * offset reads; measured again before every toast, since the bars differ per page.
 */
function measureBottom(){
  const height=window.innerHeight;
  const tops=[...document.querySelectorAll<HTMLElement>('body > *, .mobile-nav, [class*="sticky"], [class*="-bar"], [class*="dock"]')].filter(element=>{
    const style=getComputedStyle(element);
    if(style.position!=='fixed'||style.visibility==='hidden'||style.display==='none'||element.closest('[data-sonner-toaster]'))return false;
    const box=element.getBoundingClientRect();
    return box.width>window.innerWidth*.6&&box.bottom>height*.75&&box.top>height*.5&&box.height>0;
  }).map(element=>element.getBoundingClientRect().top);
  const gap=tops.length?Math.max(0,height-Math.min(...tops)):0;
  document.documentElement.style.setProperty('--toast-bottom',`${Math.round(gap+12)}px`);
}

/**
 * The shell's Toaster, mounted in the browser once the page is idle, or at once when a toast is raised first.
 * Redesigned 2 November 2026 (owner: "окошко как будто старое"): a soft card with an icon in a tinted circle, title and
 * optional line under it, one filled action and ×; phones at the bottom above the fixed bars, wide screens top-right
 * under the header. Every toast leaves the moment the customer goes to another screen (lib/market/toast-route.ts).
 */
export function ToasterSlot({theme,label}:{theme:'dark'|'light'|'system';label:string}){
  const [on,setOn]=useState(false);
  const [phone,setPhone]=useState(false);
  const pathname=usePathname();
  const shown=useRef(pathname);
  useEffect(()=>{
    toasterHost.onRequest(()=>setOn(true));
    toasterHost.beforeShow(()=>{if(window.matchMedia(phoneQuery).matches)measureBottom()});
    const show=()=>setOn(true);
    if('requestIdleCallback' in window){const id=window.requestIdleCallback(show,{timeout:4000});return()=>window.cancelIdleCallback(id)}
    const id=setTimeout(show,2500);return()=>clearTimeout(id);
  },[]);
  useEffect(()=>{
    const media=window.matchMedia(phoneQuery),sync=()=>setPhone(media.matches);
    sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);
  },[]);
  // Another screen: every toast goes at once. The catalog's product sheet (pushState to /catalog/p/<id> and back) is
  // the same screen. A tap on the bottom bar or a header link clears them too, before the next page has even loaded.
  useEffect(()=>{
    if(!toastSurvivesRoute(shown.current??'',pathname??''))toast.dismiss();
    shown.current=pathname;
  },[pathname]);
  useEffect(()=>{
    const leave=(event:MouseEvent)=>{
      const link=(event.target as Element|null)?.closest?.('.mobile-nav a, .site-header a, .shell-header a');
      if(!link)return;
      const href=link.getAttribute('href')??'';
      if(!toastSurvivesRoute(window.location.pathname,href))toast.dismiss();
    };
    const back=()=>{if(!toastSurvivesRoute(shown.current??'',window.location.pathname))toast.dismiss()};
    document.addEventListener('click',leave,true);window.addEventListener('popstate',back);
    return()=>{document.removeEventListener('click',leave,true);window.removeEventListener('popstate',back)};
  },[]);
  // The toast region's screen-reader name in the page language (sonner's default is the English "Notifications").
  return on?<Suspense fallback={null}><Toaster
    position={phone?'bottom-center':'top-right'}
    theme={theme}
    closeButton
    duration={4000}
    gap={10}
    visibleToasts={3}
    offset={{top:88,right:24}}
    mobileOffset={{bottom:'var(--toast-bottom, 88px)',left:16,right:16}}
    swipeDirections={phone?['bottom','right','left']:['right','top']}
    icons={{success:<CheckCircle2 size={18} aria-hidden="true"/>,error:<XCircle size={18} aria-hidden="true"/>,warning:<AlertTriangle size={18} aria-hidden="true"/>,info:<Info size={18} aria-hidden="true"/>}}
    toastOptions={{className:'atlas-toast'}}
    containerAriaLabel={label}
  /><Mounted/></Suspense>:null;
}
