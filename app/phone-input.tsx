'use client';
import {useLayoutEffect,useRef,type InputHTMLAttributes} from 'react';
import {caretAfterDigits,deleteAcrossSpace,editUzPhone,formatUzLocal,uzPhoneDigits} from '@/lib/market/addresses';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'|'defaultValue'>&{digits:string;onDigits:(digits:string)=>void};

/**
 * The nine local digits after a fixed +998. Groups them as "90 123 45 67" while typing, keeps the
 * caret where it was, deletes across group spaces and accepts a pasted "+998 …" number.
 */
export function UzPhoneInput({digits,onDigits,onKeyDown,onPaste,...props}:Props){
 const ref=useRef<HTMLInputElement>(null);
 const caret=useRef<number|null>(null);
 const formatted=formatUzLocal(digits);
 useLayoutEffect(()=>{
  const input=ref.current,count=caret.current;
  caret.current=null;
  if(!input||count===null||document.activeElement!==input)return;
  const position=caretAfterDigits(formatted,count);
  input.setSelectionRange(position,position);
 });
 const commit=(next:{digits:string;caret:number})=>{caret.current=next.caret;onDigits(next.digits)};
 return <input ref={ref} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="90 123 45 67" {...props} value={formatted}
  onChange={event=>commit(editUzPhone(digits,event.target.value,event.target.selectionStart??event.target.value.length))}
  onKeyDown={event=>{
   const input=event.currentTarget,start=input.selectionStart??0;
   if((event.key==='Backspace'||event.key==='Delete')&&start===input.selectionEnd){
    const next=deleteAcrossSpace(digits,formatted,start,event.key);
    if(next){event.preventDefault();commit(next)}
   }
   onKeyDown?.(event);
  }}
  onPaste={event=>{
   const text=event.clipboardData.getData('text');
   // A whole number replaces the field; a fragment is inserted where the caret is.
   if(text.replace(/\D/g,'').length>=9){event.preventDefault();const next=uzPhoneDigits(text);commit({digits:next,caret:next.length})}
   onPaste?.(event);
  }}
 />;
}
