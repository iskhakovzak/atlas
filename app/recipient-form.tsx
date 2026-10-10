'use client';
import {capitalizeFirst,capitalizeWords} from '@/lib/market/text-case';
import {useId,useState,type FormEvent} from 'react';
import {Check,Loader2} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {recipientCopy} from '@/lib/market/customer-copy';
import {cities,isServedRegion,onlyServedCity,regionCapital,regionLabel,regions,streets,suggestions,uzPhone,uzPhoneDigits} from '@/lib/market/addresses';
import {UzPhoneInput} from './phone-input';
import {isPostalCode,type DeliveryProfile,type SavedDeliveryProfile} from '@/lib/market/domain';
import type {Locale} from '@/lib/market/i18n';

export type RecipientDraft={label:string;profile:DeliveryProfile;primary:boolean};

/** Add or edit a saved recipient. Errors show next to the fields after the first submit. */
export function RecipientForm({locale,initial,isFirst,onSave}:{locale:Locale;initial?:SavedDeliveryProfile;isFirst:boolean;onSave:(value:RecipientDraft)=>Promise<unknown>}){
 const c=recipientCopy[locale];
 const uid=useId();
 const presets=[c.labels.home,c.labels.work,c.labels.parents];
 const startLabel=initial?.label??(isFirst?c.labels.home:'');
 const [labelChoice,setLabelChoice]=useState(presets.includes(startLabel)||!startLabel?startLabel:'other');
 const [customLabel,setCustomLabel]=useState(presets.includes(startLabel)?'':startLabel);
 const [value,setValue]=useState<DeliveryProfile>({recipient:initial?.recipient??'',phone:initial?.phone??'',region:onlyServedCity??initial?.region??'Ташкент',city:onlyServedCity??initial?.city??'Ташкент',address:initial?.address??'',postalCode:initial?.postalCode??'',comment:initial?.comment??''});
 const [phoneDigits,setPhoneDigits]=useState(uzPhoneDigits(initial?.phone??''));
 const lockedPrimary=Boolean(initial?.primary)||isFirst;
 const [primary,setPrimary]=useState(lockedPrimary);
 const [touched,setTouched]=useState(false),[saving,setSaving]=useState(false);
 const label=(labelChoice==='other'?customLabel:labelChoice).trim();
 const errors={label:!label,recipient:value.recipient.trim().length<2,phone:phoneDigits.length!==9,region:!value.region,city:value.city.trim().length<2,address:value.address.trim().length<5,postal:!isPostalCode(value.postalCode)};
 const show=(field:keyof typeof errors)=>touched&&errors[field];
 async function submit(event:FormEvent){
  event.preventDefault();
  setTouched(true);
  const first=(Object.keys(errors) as (keyof typeof errors)[]).find(field=>errors[field]);
  if(first){document.getElementById(`${uid}-${first==='label'&&labelChoice!=='other'?'label-0':first}`)?.focus();return}
  setSaving(true);
  try{await onSave({label,primary,profile:{...value,recipient:value.recipient.trim(),phone:uzPhone(phoneDigits),city:value.city.trim(),address:value.address.trim(),postalCode:value.postalCode.trim(),comment:value.comment.trim()}})}
  finally{setSaving(false)}
 }
 const hint=(field:keyof typeof errors,text?:string)=>show(field)?<small id={`${uid}-${field}-hint`} className="rf-error" role="alert">{field==='phone'?c.phoneError:field==='postal'?c.postalError:c.required}</small>:text?<small id={`${uid}-${field}-hint`}>{text}</small>:null;
 return <form className="rf" onSubmit={submit} noValidate>
  <fieldset className={'rf-labels'+(show('label')?' invalid':'')}>
   <legend>{c.labelLegend}</legend>
   <div className="rf-chips">{[...presets,'other'].map((option,index)=><button type="button" key={option} id={`${uid}-label-${index}`} aria-pressed={labelChoice===option} onClick={()=>setLabelChoice(option)}>{option==='other'?c.labels.other:option}</button>)}</div>
   {labelChoice==='other'&&<input id={`${uid}-label`} aria-label={c.customLabel} placeholder={c.customLabel} maxLength={60} value={customLabel} aria-invalid={show('label')} onChange={event=>setCustomLabel(event.target.value)}/>}
   {hint('label')}
  </fieldset>
  <div className={'rf-field'+(show('recipient')?' invalid':'')}>
   <label htmlFor={`${uid}-recipient`}>{c.name}</label>
   <input id={`${uid}-recipient`} autoComplete="name" autoCapitalize="words" maxLength={100} value={value.recipient} aria-invalid={show('recipient')} aria-describedby={`${uid}-recipient-hint`} onChange={event=>setValue({...value,recipient:capitalizeWords(event.target.value)})}/>
   {hint('recipient',c.nameHint)}
  </div>
  <div className={'rf-field'+(show('phone')?' invalid':'')}>
   <label htmlFor={`${uid}-phone`}>{c.phone}<span className="sr-only"> +998</span></label>
   <span className="rf-phone"><span aria-hidden="true">+998</span><UzPhoneInput id={`${uid}-phone`} digits={phoneDigits} onDigits={setPhoneDigits} aria-invalid={show('phone')} aria-describedby={`${uid}-phone-hint`}/></span>
   {hint('phone',c.phoneHint)}
  </div>
  {onlyServedCity?<div className="rf-field">
   {/* Tashkent only for now (10.10.2026): the city is fixed; a recipient saved elsewhere is asked for a Tashkent address. */}
   <span className="rf-label">{c.city}</span>
   <p className="rf-fixed">{regionLabel(onlyServedCity,locale)}</p>
   {initial&&!isServedRegion(initial.region)?<small className="rf-error" role="alert">{c.outsideServed}</small>:<small>{c.servedOnly}</small>}
  </div>:<div className="rf-row">
   <div className={'rf-field'+(show('region')?' invalid':'')}>
    <label htmlFor={`${uid}-region`}>{c.region}</label>
    <select id={`${uid}-region`} value={value.region} autoComplete="address-level1" onChange={event=>{const region=event.target.value,capital=regionCapital(region);setValue(current=>({...current,region,city:!current.city.trim()||cities.includes(current.city)?capital??current.city:current.city}))}}>
     {!value.region&&<option value="">{c.regionPlaceholder}</option>}
     {regions.map(region=><option key={region} value={region}>{regionLabel(region,locale)}</option>)}
    </select>
    {hint('region')}
   </div>
   <div className={'rf-field'+(show('city')?' invalid':'')}>
    <label htmlFor={`${uid}-city`}>{c.city}</label>
    <input id={`${uid}-city`} list={`${uid}-cities`} autoComplete="address-level2" autoCapitalize="sentences" maxLength={100} value={value.city} aria-invalid={show('city')} onChange={event=>setValue({...value,city:capitalizeFirst(event.target.value)})}/>
    <datalist id={`${uid}-cities`}>{suggestions(cities,value.city).map(city=><option key={city} value={city}/>)}</datalist>
    {hint('city')}
   </div>
  </div>}
  <div className={'rf-field'+(show('address')?' invalid':'')}>
   <label htmlFor={`${uid}-address`}>{c.address}</label>
   <input id={`${uid}-address`} list={`${uid}-streets`} autoComplete="street-address" autoCapitalize="sentences" maxLength={220} placeholder={c.addressPlaceholder} value={value.address} aria-invalid={show('address')} aria-describedby={`${uid}-address-hint`} onChange={event=>setValue({...value,address:capitalizeFirst(event.target.value)})}/>
   <datalist id={`${uid}-streets`}>{suggestions(streets,value.address).map(street=><option key={street} value={street}/>)}</datalist>
   {hint('address',c.privacy)}
  </div>
  <div className="rf-row">
   <div className={'rf-field'+(show('postal')?' invalid':'')}><label htmlFor={`${uid}-postal`}>{c.postal}</label><input id={`${uid}-postal`} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={value.postalCode} aria-invalid={show('postal')} aria-describedby={`${uid}-postal-hint`} onChange={event=>setValue({...value,postalCode:event.target.value.replace(/\D/g,'').slice(0,6)})}/>{hint('postal',c.postalHint)}</div>
   <div className="rf-field"><label htmlFor={`${uid}-comment`}>{c.comment} <span className="rf-optional">({c.optional})</span></label><input id={`${uid}-comment`} maxLength={300} placeholder={c.commentPlaceholder} value={value.comment} onChange={event=>setValue({...value,comment:event.target.value})}/></div>
  </div>
  <div className="basket-consent rf-primary"><Checkbox id={`${uid}-primary`} checked={primary} disabled={lockedPrimary} onCheckedChange={checked=>setPrimary(checked===true)}/><label htmlFor={`${uid}-primary`}>{c.primary}</label></div>
  <button className="btn primary basket-cta" disabled={saving}>{saving?<Loader2 size={18} className="spin" aria-hidden="true"/>:<Check size={18} aria-hidden="true"/>}{saving?c.saving:c.save}</button>
 </form>;
}
