'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Globe} from 'lucide-react';
import type {Locale} from '@/lib/market/i18n';

/** Each language names itself in its own script; the Uzbek pair says which alphabet it is. */
const languages:{code:Locale;lang:string;name:string;script?:string;short:string}[]=[
  {code:'ru',lang:'ru',name:'Русский',short:'RU'},
  {code:'uz',lang:'uz-Latn',name:'O‘zbekcha',script:'lotin yozuvi',short:'UZ'},
  {code:'oz',lang:'uz-Cyrl',name:'Ўзбекча',script:'кирилл ёзуви',short:'ЎЗ'},
  {code:'en',lang:'en',name:'English',short:'EN'},
];

/** Header language menu: one compact button (the current language) that opens the four choices. */
export function HeaderLanguage({locale,label,onChange}:{locale:Locale;label:string;onChange:(locale:Locale)=>void}){
  const [open,setOpen]=useState(false);
  const wrap=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),listId=useId();
  const current=languages.find(item=>item.code===locale)??languages[0];
  useEffect(()=>{
    if(!open)return;
    // Focus the chosen language; Escape or a click outside closes the list (Escape returns focus to the button).
    wrap.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    const outside=(event:PointerEvent)=>{if(!wrap.current?.contains(event.target as Node))setOpen(false)};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};
  },[open]);
  const move=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const items=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')],at=items.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    event.preventDefault();items[next]?.focus();
  };
  return <div className="lang-menu" ref={wrap} onBlur={event=>{if(open&&!wrap.current?.contains(event.relatedTarget as Node))setOpen(false)}}>
    <button type="button" ref={trigger} className="lang-trigger" aria-expanded={open} aria-controls={listId} aria-label={`${label}: ${current.name}${current.script?' — '+current.script:''}`} title={label} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true)}}}>
      <Globe size={17} aria-hidden="true"/><span lang={current.lang}>{current.short}</span><ChevronDown size={14} aria-hidden="true" className="lang-chevron"/>
    </button>
    <div className="lang-menu-list" id={listId} role="group" aria-label={label} hidden={!open} onKeyDown={move}>
      {languages.map(item=><button type="button" key={item.code} data-locale={item.code} aria-current={item.code===locale} onClick={()=>{onChange(item.code);setOpen(false);trigger.current?.focus()}}>
        <span lang={item.lang}><b>{item.name}</b>{item.script&&<small>{item.script}</small>}</span>{item.code===locale&&<Check size={16} aria-hidden="true"/>}
      </button>)}
    </div>
  </div>;
}
