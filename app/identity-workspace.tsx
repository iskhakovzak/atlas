"use client";
import {capitalizeWords} from "@/lib/market/text-case";

import {useEffect,useMemo,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "@/components/site-link";
import { InfoTip } from "@/components/info-tip";
import {Checkbox} from "@/components/ui/checkbox";
import {AlertTriangle,ArrowRight,Check,FileCheck2,LoaderCircle,Plus,ShieldCheck,Trash2} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {useMarket} from "@/lib/market/store";
import {formatSum} from "@/lib/market/format";
import {docsCopy,formatDateTime,formatLongDate,orderCount,recipientCopy} from "@/lib/market/customer-copy";
import {courierAllowanceUsd} from "@/lib/market/customs";
import {Empty} from "./market-ui";
import {Modal} from "./modal";
import {RecipientForm,type RecipientDraft} from "./recipient-form";
import {pickLocale,uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

type DocumentRow={id:string;filename:string;content_type?:string;contentType?:string;size:number;status:string;created_at?:number;createdAt?:number};
/** Stable no-op for useInlineRecipient on the declaration page: its effect depends on the callback. */
const noop=()=>{};
type IdentityForm={firstName:string;lastName:string;birthDate:string;passportNumber:string;pinfl:string;nationality:string};
const empty:IdentityForm={firstName:"",lastName:"",birthDate:"",passportNumber:"",pinfl:"",nationality:""};

/** Adds a recipient from a document page, then selects it once the saved state comes back. */
function useInlineRecipient(onAdded:(id:string)=>void){
  const {state,act}=useMarket();
  const [open,setOpen]=useState(false);
  const pending=useRef<string|null>(null);
  // The modal has no Radix trigger, so focus is handed back by hand to the button that opened it (Esc, close, save).
  const opener=useRef<HTMLElement|null>(null);
  function show(){opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true)}
  function close(){setOpen(false);const target=opener.current;opener.current=null;if(target)requestAnimationFrame(()=>{if(target.isConnected)target.focus()})}
  useEffect(()=>{
    const key=pending.current;if(!key)return;
    const added=state.deliveryProfiles.find(profile=>`${profile.recipient}|${profile.address}`===key);
    if(added){pending.current=null;queueMicrotask(()=>onAdded(added.id))}
  },[state.deliveryProfiles,onAdded]);
  async function save(value:RecipientDraft){
    pending.current=`${value.profile.recipient}|${value.profile.address}`;
    if(await act({type:'delivery-profile-save',value:value.profile,label:value.label,primary:value.primary})){close();toast.success(recipientCopy[state.communication.language].saved)}
    else pending.current=null;
  }
  return {open,show,close,save};
}

/**
 * Passport details typed as text: series and number, PINFL, name and date of birth (13.10.2026). Atlas no longer takes
 * scans or photos (they may count as biometric data); scans uploaded before stay listed only so they can be deleted.
 */
export function IdentityView({embedded=false}:{embedded?:boolean}={}){
  const {state,user,ready,act}=useMarket();
  const lang=state.communication.language;
  const c=pickLocale({ru:{notReady:'Войдите, чтобы добавить паспорт',notReadyText:'Паспортные данные доступны только владельцу профиля.',open:'Открыть вход',last:'Фамилия',first:'Имя',birth:'Дата рождения',nationality:'Гражданство',number:'Серия и номер паспорта',numberHint:'Как в паспорте или ID-карте: две буквы и семь цифр.',pinfl:'ПИНФЛ',pinflHint:'14 цифр — на странице с фото паспорта или на обороте ID-карты. Нужен таможне для граждан Узбекистана.',pinflError:'ПИНФЛ — ровно 14 цифр. Проверьте его в паспорте или оставьте поле пустым.',consent:'Согласен на',processing:'обработку паспортных данных',confirmed:'Подтверждено',confirm:'Сохранить паспорт',need:(list:string,consent:boolean)=>list?`Чтобы сохранить, заполните: ${list}${consent?' и отметьте согласие':''}.`:'Чтобы сохранить, отметьте согласие.',textOnly:'Только текст: сканы и фото паспорта Atlas не принимает и не хранит.',deleteData:'Удалить данные паспорта',oldScans:'Ранее загруженные сканы',oldScansNote:'Сканы больше не нужны — данные вводятся текстом. Удалите их: Atlas не хранит изображения документов.',confirmedData:'данные подтверждены',pending:'не подтверждён',delete:'Удалить скан',warning:'Atlas не выполняет государственную проверку документа и не отправляет его в таможню автоматически.'},uz:{notReady:'Pasport qo‘shish uchun kiring',notReadyText:'Pasport ma’lumotlari faqat profil egasiga ko‘rinadi.',open:'Kirishni ochish',last:'Familiya',first:'Ism',birth:'Tug‘ilgan sana',nationality:'Fuqarolik',number:'Pasport seriyasi va raqami',numberHint:'Pasport yoki ID-kartadagidek: ikki harf va yetti raqam.',pinfl:'JSHSHIR (PINFL)',pinflHint:'14 raqam — pasportning suratli sahifasida yoki ID-kartaning orqa tomonida. O‘zbekiston fuqarolari uchun bojxonaga kerak.',pinflError:'JSHSHIR — aniq 14 raqam. Pasportdan tekshiring yoki maydonni bo‘sh qoldiring.',consent:'Men roziman:',processing:'pasport ma’lumotlarini qayta ishlashga',confirmed:'Tasdiqlangan',confirm:'Pasportni saqlash',need:(list:string,consent:boolean)=>list?`Saqlash uchun to‘ldiring: ${list}${consent?' va roziligingizni belgilang':''}.`:'Saqlash uchun roziligingizni belgilang.',textOnly:'Faqat matn: Atlas pasport skanlari va suratlarini qabul qilmaydi va saqlamaydi.',deleteData:'Pasport ma’lumotlarini o‘chirish',oldScans:'Avval yuklangan skanlar',oldScansNote:'Skanlar endi kerak emas — ma’lumotlar matn bilan kiritiladi. Ularni o‘chiring: Atlas hujjat tasvirlarini saqlamaydi.',confirmedData:'ma’lumotlar tasdiqlangan',pending:'tasdiqlanmagan',delete:'Skanni o‘chirish',warning:'Atlas hujjatni davlat tomonidan tekshirmaydi va uni bojxonaga avtomatik yubormaydi.'},en:{notReady:'Sign in to add a passport',notReadyText:'Passport details are available only to the profile owner.',open:'Open sign in',last:'Last name',first:'First name',birth:'Date of birth',nationality:'Nationality',number:'Passport series and number',numberHint:'As in the passport or ID card: two letters and seven digits.',pinfl:'PINFL',pinflHint:'14 digits — on the passport photo page or the back of the ID card. Customs needs it for citizens of Uzbekistan.',pinflError:'The PINFL is exactly 14 digits. Check it in the passport or leave the field empty.',consent:'I agree to',processing:'passport data processing',confirmed:'Confirmed',confirm:'Save passport',need:(list:string,consent:boolean)=>list?`To save, fill in: ${list}${consent?' and tick the consent':''}.`:'To save, tick the consent.',textOnly:'Text only: Atlas does not accept or keep passport scans or photos.',deleteData:'Delete passport details',oldScans:'Scans uploaded earlier',oldScansNote:'Scans are no longer needed — details are typed as text. Delete them: Atlas does not keep document images.',confirmedData:'details confirmed',pending:'not confirmed',delete:'Delete scan',warning:'Atlas does not perform government document verification and does not send it to customs automatically.'}}, lang);
  const d=docsCopy[lang];
  const requested=useSearchParams().get('recipient')??'';
  const [docs,setDocs]=useState<DocumentRow[]>([]),[consent,setConsent]=useState(false),[form,setForm]=useState<IdentityForm>(empty),[busy,setBusy]=useState(false),[recipientProfileId,setRecipientProfileId]=useState("");
  // Saved in this visit: the form is cleared, so instead of Save (and its "fill in" hint) show the way back. Any edit makes a new form object and ends it.
  const [justSaved,setJustSaved]=useState(false);
  const recipientProfiles=state.deliveryProfiles;
  const identities=useMemo(()=>state.identityProfiles??(state.identityProfile?[state.identityProfile]:[]),[state.identityProfiles,state.identityProfile]);
  // A link from the account ("add passport" on a recipient) preselects that recipient.
  const selectedRecipientProfileId=recipientProfileId||(recipientProfiles.some(profile=>profile.id===requested)?requested:'')||((recipientProfiles.find(profile=>profile.primary)??recipientProfiles[0])?.id??"");
  const inline=useInlineRecipient(id=>{setRecipientProfileId(id);setForm(empty);setJustSaved(false)});
  useEffect(()=>{if(!user)return;void fetch('/api/passport',{cache:'no-store'}).then(async r=>{const data=await r.json() as {documents?:DocumentRow[];error?:string};if(!r.ok)throw Error(data.error??d.loadError);setDocs(data.documents??[])}).catch(e=>toast.error((e as Error).message))},[user,d.loadError]);
  const current=identities.find(profile=>profile.recipientProfileId===selectedRecipientProfileId);
  // Names and the date of birth start from the confirmed entry; the number and PINFL are typed again (only their last digits are kept here).
  const filled:IdentityForm={...form,firstName:form.firstName||(current?.firstName??""),lastName:form.lastName||(current?.lastName??""),birthDate:form.birthDate||(current?.birthDate??""),nationality:form.nationality||(current?.nationality??"")};
  const pinflDigits=filled.pinfl.replace(/\D/g,''),pinflBad=filled.pinfl.trim()!==''&&pinflDigits.length!==14;
  const numberOk=filled.passportNumber.replace(/[^A-Za-z0-9]/g,'').length>=6,numberBad=filled.passportNumber.trim()!==''&&!numberOk;
  const complete=Boolean(filled.firstName&&filled.lastName&&filled.birthDate&&numberOk&&(!filled.pinfl.trim()||pinflDigits.length===14));
  // Why Save is off: the fields still missing (by their labels) and the consent, said under the button.
  const missing=([[!filled.lastName,c.last],[!filled.firstName,c.first],[!filled.birthDate,c.birth],[!numberOk,c.number],[pinflBad,c.pinfl]] as [boolean,string][]).filter(([gap])=>gap).map(([,label])=>label===c.pinfl?label:label.charAt(0).toLocaleLowerCase(lang==='en'?'en-US':'ru-RU')+label.slice(1));
  const saveHint=complete&&consent?'':c.need(missing.join(', '),!consent);
  // Only while the saved entry is there: deleting it right after saving brings Save back, not "back to orders".
  const done=justSaved&&form===empty&&Boolean(current);
  // Orders of this recipient still on their way: the passport was most likely added for them.
  const waitingOrders=state.orders.some(order=>!order.cancelled&&order.status<5&&order.deliveryProfileId===selectedRecipientProfileId);
  const today=new Date().toISOString().slice(0,10);
  async function confirm(){if(!selectedRecipientProfileId||!consent||!complete)return;setBusy(true);const ok=await act({type:'identity-confirm',recipientProfileId:selectedRecipientProfileId,firstName:filled.firstName,lastName:filled.lastName,birthDate:filled.birthDate,passportNumber:filled.passportNumber,nationality:filled.nationality,...(pinflDigits?{pinfl:pinflDigits}:{})});setBusy(false);if(ok){setForm(empty);setJustSaved(true);toast.success(d.confirmedToast)}}
  // Deletes a scan, or the typed details of a recipient (their row has no image). A row already gone still clears the entry.
  async function remove(id:string,question:string){if(!window.confirm(question))return;setBusy(true);try{const response=await fetch('/api/passport?id='+encodeURIComponent(id),{method:'DELETE'});if(!response.ok&&response.status!==404){const data=await response.json() as {error?:string};throw Error(data.error??d.deleteError)}if(identities.some(identity=>identity.documentId===id))await act({type:'identity-clear',documentId:id});setDocs(list=>list.filter(doc=>doc.id!==id));toast.success(d.deleted)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
  if(!ready)return <Empty title={c.notReady} description={c.notReadyText} href="/account" label={c.open}/>;
  // On /account/documents (1 November 2026) the passports are one section of the page, under its own heading.
  return <div className="docs-page" id={embedded?'passports':undefined}>
    <header className="orders-head"><div>{embedded?<h2>{d.title}</h2>:<h1>{d.title}</h1>}<p>{d.lead}</p></div></header>
    <ol className="docs-steps">
      <li className="cabinet-card docs-step">
        <h2><span className="docs-num" aria-hidden="true">1</span>{d.whose}<InfoTip locale={lang}>{d.whoseHint}</InfoTip></h2>
        <p className="cabinet-lead tip-text">{d.whoseHint}</p>
        {recipientProfiles.length?<div className="docs-recipients" role="radiogroup" aria-label={d.whose}>{recipientProfiles.map(profile=>{
          const passport=identities.find(identity=>identity.recipientProfileId===profile.id),checked=profile.id===selectedRecipientProfileId;
          return <label key={profile.id} className={'docs-recipient'+(checked?' selected':'')}>
            <input type="radio" name="passport-recipient" value={profile.id} checked={checked} onChange={()=>{setRecipientProfileId(profile.id);setForm(empty);setJustSaved(false)}}/>
            <span className="docs-recipient-copy"><b>{profile.recipient}</b><small>{profile.label}</small></span>
            <span className={'cabinet-chip '+(passport?'ok':'warn')}>{passport?<Check size={14} aria-hidden="true"/>:null}{passport?d.passportOk(passport.passportMasked):d.passportMissing}</span>
          </label>;
        })}</div>:null}
        <button type="button" className="cabinet-add" onClick={inline.show}><Plus size={18} aria-hidden="true"/>{d.addRecipient}</button>
      </li>
      <li className={'cabinet-card docs-step'+(selectedRecipientProfileId?'':' muted')}>
        <h2><span className="docs-num" aria-hidden="true">2</span>{current?d.replaceStep:d.uploadStep}</h2>
        {!selectedRecipientProfileId?<p className="cabinet-empty">{recipientProfiles.length?d.pickFirst:d.noRecipient}</p>:<div className="docs-fields">
          <p className="cabinet-note">{c.textOnly}</p>
          <div className="rf-row"><div className="rf-field"><label htmlFor="last-name">{c.last}</label><input id="last-name" required autoComplete="family-name" autoCapitalize="words" value={filled.lastName} onChange={e=>setForm({...form,lastName:capitalizeWords(e.target.value)})}/></div><div className="rf-field"><label htmlFor="first-name">{c.first}</label><input id="first-name" required autoComplete="given-name" autoCapitalize="words" value={filled.firstName} onChange={e=>setForm({...form,firstName:capitalizeWords(e.target.value)})}/></div></div>
          <div className="rf-row"><div className="rf-field"><label htmlFor="birth-date">{c.birth}</label><input id="birth-date" type="date" required autoComplete="bday" max={today} value={filled.birthDate} onChange={e=>setForm({...form,birthDate:e.target.value})}/></div><div className="rf-field"><label htmlFor="nationality">{c.nationality}</label><input id="nationality" autoComplete="country-name" value={filled.nationality} onChange={e=>setForm({...form,nationality:e.target.value})}/></div></div>
          <div className="rf-row"><div className={"rf-field"+(numberBad?" invalid":"")}><label htmlFor="passport-number">{c.number}</label><input id="passport-number" required minLength={6} maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={filled.passportNumber} placeholder={current?.passportMasked??"AA 1234567"} aria-describedby="passport-number-hint" aria-invalid={numberBad} onChange={e=>setForm({...form,passportNumber:e.target.value.toUpperCase()})}/><small id="passport-number-hint">{c.numberHint}</small></div>
          <div className={"rf-field"+(pinflBad?" invalid":"")}><label htmlFor="passport-pinfl">{c.pinfl}</label><input id="passport-pinfl" inputMode="numeric" autoComplete="off" maxLength={20} spellCheck={false} value={filled.pinfl} placeholder={current?.pinflMasked??"12345678901234"} aria-describedby="passport-pinfl-hint" aria-invalid={pinflBad} onChange={e=>setForm({...form,pinfl:e.target.value.replace(/[^\d ]/g,'')})}/><small id="passport-pinfl-hint" className={pinflBad?"id-field-error":undefined}>{pinflBad?c.pinflError:c.pinflHint}</small></div></div>
          <div className="basket-consent"><Checkbox id="passport-consent" aria-label={`${c.consent} ${c.processing}`} checked={consent} onCheckedChange={value=>setConsent(value===true)}/><label htmlFor="passport-consent">{c.consent} <Link href="/legal#passport-consent" target="_blank" rel="noopener noreferrer">{c.processing}</Link>.</label></div>
          {current&&<p className="lo-note"><Check size={16} aria-hidden="true"/>{c.confirmed} {formatLongDate(current.confirmedAt,lang)}: {current.lastName} {current.firstName}, {current.birthDate}, {current.passportMasked}{current.pinflMasked?`, ${c.pinfl} ${current.pinflMasked}`:''}</p>}
          {done?(waitingOrders
            ?<Link className="btn primary basket-cta" href="/orders">{d.backToOrders}<ArrowRight aria-hidden="true"/></Link>
            :<Link className="btn secondary basket-cta" href="/order-by-link">{d.newOrder}</Link>)
          :<>
          <button type="button" className="btn primary basket-cta" disabled={busy||!consent||!complete} aria-describedby={saveHint?"passport-save-hint":undefined} onClick={()=>void confirm()}>{busy?<LoaderCircle className="spin" aria-hidden="true"/>:<ShieldCheck aria-hidden="true"/>}{c.confirm}</button>
          {saveHint&&<p id="passport-save-hint" className="cabinet-note">{saveHint}</p>}
          </>}
          {current&&<button type="button" className="cabinet-text-btn" disabled={busy} onClick={()=>void remove(current.documentId,d.deleteDataConfirm)}><Trash2 size={15} aria-hidden="true"/>{c.deleteData}</button>}
        </div>}
      </li>
    </ol>
    {docs.length>0&&<section className="cabinet-card docs-scans" aria-labelledby="docs-scans-title"><h2 id="docs-scans-title">{c.oldScans}</h2><p className="lo-note warn"><AlertTriangle size={16} aria-hidden="true"/>{c.oldScansNote}</p><ul className="cabinet-rows">{docs.map(doc=>{const identity=identities.find(item=>item.documentId===doc.id);const recipient=recipientProfiles.find(item=>item.id===identity?.recipientProfileId);return <li key={doc.id} className="docs-scan"><FileCheck2 aria-hidden="true"/><span><b>{doc.filename}</b><small>{Math.ceil(doc.size/1024)} KB · {doc.status==='confirmed'?c.confirmedData:c.pending}{recipient?` · ${recipient.recipient}`:''}</small></span><button type="button" className="icon-btn" aria-label={`${c.delete}: ${doc.filename}`} disabled={busy} onClick={()=>void remove(doc.id,d.deleteConfirm)}><Trash2 aria-hidden="true"/></button></li>})}</ul></section>}
    <p className="lo-note"><AlertTriangle size={16} aria-hidden="true"/>{c.warning}</p>
    <Modal open={inline.open} onClose={inline.close} title={recipientCopy[lang].addTitle} description={recipientCopy[lang].note} locale={lang}>{inline.open&&<RecipientForm locale={lang} isFirst={!recipientProfiles.length} onSave={inline.save}/>}</Modal>
  </div>;
}

export function DeclarationView({embedded=false}:{embedded?:boolean}={}){
  const {state,ready,act,pricing}=useMarket();const eligible=state.orders.filter(order=>!order.cancelled);const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const identities=state.identityProfiles??(state.identityProfile?[state.identityProfile]:[]);
  const selectedOrders=eligible.filter(order=>selected.includes(order.id));
  const referenceOrder=selectedOrders[0];
  const recipientKey=referenceOrder?.deliveryProfileId??"legacy";
  const recipientProfile=referenceOrder?.deliveryProfileId?state.deliveryProfiles.find(profile=>profile.id===referenceOrder.deliveryProfileId):(state.deliveryProfiles.find(profile=>profile.primary)??state.deliveryProfiles[0]);
  const primary=state.deliveryProfiles.find(profile=>profile.primary)??state.deliveryProfiles[0];
  // The server's rule: an order for a saved recipient uses only that recipient's passport, never another person's.
  // Orders without a saved recipient (older ones, or a typed address) use the server's fallback: the order's own snapshot,
  // then a passport tied to no recipient, then the account passport. With nothing selected, the primary recipient's.
  const passportRecipientId=referenceOrder?referenceOrder.deliveryProfileId:primary?.id;
  const recipientIdentity=passportRecipientId?identities.find(profile=>profile.recipientProfileId===passportRecipientId):undefined;
  const displayIdentity=referenceOrder?.deliveryProfileId?((referenceOrder.identity&&(!referenceOrder.identity.recipientProfileId||referenceOrder.identity.recipientProfileId===referenceOrder.deliveryProfileId)?referenceOrder.identity:undefined)??recipientIdentity):referenceOrder?(referenceOrder.identity??identities.find(profile=>!profile.recipientProfileId)??state.identityProfile):recipientIdentity;
  const displayDelivery=referenceOrder?.delivery??recipientProfile??state.deliveryProfile;
  const lang=state.communication.language;
  const c=lang==='ru'?{over:'ТАМОЖЕННЫЙ ПАКЕТ',title:'Декларация без повторного ввода.',intro:'Atlas подставляет только подтверждённые паспортные данные, адрес и сведения из выбранных заказов.',login:'Войдите, чтобы открыть декларации',loginText:'Документы привязаны к вашему профилю Atlas.',open:'Открыть вход',docs:'ДОКУМЕНТЫ',draftTitle:'Декларация',draftIntro:'Подготовим черновик из ваших заказов.',passport:'Подтвердите паспорт',recipient:'Добавьте получателя',checkDoc:'Проверьте данные документа, чтобы продолжить.',saveAddress:'Сохраните адрес доставки в профиле.',checkPassport:'Проверить паспорт',addAddress:'Добавить адрес',recipientData:'Данные получателя',recipientLabel:'Получатель',birth:'Дата рождения',passportLabel:'Паспорт',notConfirmed:'Паспортные данные не подтверждены.',address:'Адрес',items:'Товары в пакете',selectAll:'Выбрать все заказы',noOrders:'Сначала оформите хотя бы один заказ.',value:'Стоимость товаров',create:'Создать черновик',private:'Пакет сохраняется только в Atlas. Передача государственным органам не выполняется.',history:'История пакетов',noDrafts:'Черновиков пока нет.',draft:'черновик',sent:'Пакет декларации подготовлен'}:{over:isUzbek(lang)?uzText(lang, 'BOJXONA PAKETI'):'CUSTOMS PACKAGE',title:isUzbek(lang)?uzText(lang, 'Qayta kiritmasdan deklaratsiya.'):'Declaration without re-entry.',intro:isUzbek(lang)?uzText(lang, 'Atlas faqat tasdiqlangan pasport, manzil va tanlangan buyurtma ma’lumotlarini qo‘shadi.'):'Atlas uses only confirmed passport details, your address and selected order data.',login:isUzbek(lang)?uzText(lang, 'Deklaratsiyalarni ochish uchun kiring'):'Sign in to open declarations',loginText:isUzbek(lang)?uzText(lang, 'Hujjatlar Atlas profilingizga bog‘langan.'):'Documents are tied to your Atlas profile.',open:isUzbek(lang)?uzText(lang, 'Kirishni ochish'):'Open sign in',docs:isUzbek(lang)?uzText(lang, 'HUJJATLAR'):'DOCUMENTS',draftTitle:isUzbek(lang)?uzText(lang, 'Deklaratsiya'):'Declaration',draftIntro:isUzbek(lang)?uzText(lang, 'Buyurtmalaringizdan qoralama tayyorlaymiz.'):'We will prepare a draft from your orders.',passport:isUzbek(lang)?uzText(lang, 'Pasportni tasdiqlang'):'Confirm your passport',recipient:isUzbek(lang)?uzText(lang, 'Qabul qiluvchini qo‘shing'):'Add a recipient',checkDoc:isUzbek(lang)?uzText(lang, 'Davom etish uchun hujjat ma’lumotlarini tekshiring.'):'Check the document details to continue.',saveAddress:isUzbek(lang)?uzText(lang, 'Profilingizda yetkazish manzilini saqlang.'):'Save a delivery address in your profile.',checkPassport:isUzbek(lang)?uzText(lang, 'Pasportni tekshirish'):'Check passport',addAddress:isUzbek(lang)?uzText(lang, 'Manzil qo‘shish'):'Add address',recipientData:isUzbek(lang)?uzText(lang, 'Qabul qiluvchi ma’lumotlari'):'Recipient details',recipientLabel:isUzbek(lang)?uzText(lang, 'Qabul qiluvchi'):'Recipient',birth:isUzbek(lang)?uzText(lang, 'Tug‘ilgan sana'):'Date of birth',passportLabel:isUzbek(lang)?uzText(lang, 'Pasport'):'Passport',notConfirmed:isUzbek(lang)?uzText(lang, 'Pasport ma’lumotlari tasdiqlanmagan.'):'Passport details are not confirmed.',address:isUzbek(lang)?uzText(lang, 'Manzil'):'Address',items:isUzbek(lang)?uzText(lang, 'Paketdagi tovarlar'):'Items in the package',selectAll:isUzbek(lang)?uzText(lang, 'Barcha buyurtmalarni tanlash'):'Select all orders',noOrders:isUzbek(lang)?uzText(lang, 'Avval kamida bitta buyurtma yarating.'):'Create at least one order first.',value:isUzbek(lang)?uzText(lang, 'Tovarlar qiymati'):'Item value',create:isUzbek(lang)?uzText(lang, 'Qoralama yaratish'):'Create draft',private:isUzbek(lang)?uzText(lang, 'Paket faqat Atlasda saqlanadi. Davlat organlariga uzatilmaydi.'):'The package is stored only in Atlas. It is not sent to government authorities.',history:isUzbek(lang)?uzText(lang, 'Paketlar tarixi'):'Package history',noDrafts:isUzbek(lang)?uzText(lang, 'Hali qoralamalar yo‘q.'):'No drafts yet.',draft:isUzbek(lang)?uzText(lang, 'qoralama'):'draft',sent:isUzbek(lang)?uzText(lang, 'Deklaratsiya paketi tayyorlandi'):'Declaration package prepared'};
  const d=docsCopy[lang];
  const total=selectedOrders.reduce((sum,order)=>sum+order.quote.merchandise,0);
  const totalUsd=Math.round(selectedOrders.reduce((sum,order)=>sum+order.quote.merchandise/(order.quote.fx??pricing.fx),0));
  // Orders are grouped the way the server checks them: one declaration per saved recipient.
  const groups=[...eligible.reduce((map,order)=>{const key=order.deliveryProfileId??"legacy";const list=map.get(key)??[];list.push(order);return map.set(key,list)},new Map<string,typeof eligible>())].map(([key,orders])=>{
    const profile=key==="legacy"?undefined:state.deliveryProfiles.find(item=>item.id===key);
    return {key,orders,name:profile?.recipient??orders[0].delivery?.recipient??c.recipientLabel};
  });
  // The passport item belongs to the selected group's recipient (the primary one when nothing is selected).
  const passportReady=referenceOrder?displayIdentity:recipientIdentity;
  // A recipient is added right here, in the same form as on /identity, without leaving for the account.
  const inline=useInlineRecipient(noop);
  const checklist:({ok:boolean;label:string;detail?:string;action:string}&({href:string}|{onAction:()=>void}))[]=[
    {ok:state.deliveryProfiles.length>0,label:d.needRecipient,detail:primary?.recipient,onAction:inline.show,action:recipientCopy[lang].addTitle},
    {ok:Boolean(passportReady),label:d.needPassport,detail:passportReady?.passportMasked,href:passportRecipientId?`/account/documents?recipient=${encodeURIComponent(passportRecipientId)}#passports`:"/account/documents#passports",action:d.addPassport},
    {ok:eligible.length>0,label:d.needOrders,detail:eligible.length?orderCount(eligible.length,lang):undefined,href:"/order-by-link",action:d.newOrder},
  ];
  // The order picker stays open while any passport is confirmed, so another recipient's group can still be chosen;
  // the submit button waits for this recipient's passport (displayIdentity).
  const readyToDeclare=checklist[0].ok&&checklist[2].ok&&identities.length>0;
  async function submit(){setBusy(true);const ok=await act({type:'declaration-preview',orderIds:selectedOrders.map(order=>order.id)});setBusy(false);if(ok)toast.success(c.sent)}
  function toggle(order:(typeof eligible)[number],value:boolean){
    const key=order.deliveryProfileId??"legacy";
    if(value&&selectedOrders.length&&key!==recipientKey){toast.error(lang==='ru'?'Для разных получателей нужны отдельные декларации.':isUzbek(lang)?uzText(lang, 'Turli qabul qiluvchilar uchun alohida deklaratsiya kerak.'):'Create separate declarations for different recipients.');return}
    setSelected(list=>value?[...new Set([...list,order.id])]:list.filter(id=>id!==order.id));
  }
  if(!ready)return <Empty title={c.login} description={c.loginText} href="/account" label={c.open}/>;
  return <div className="docs-page" id={embedded?'declarations':undefined}>
    <header className="orders-head"><div>{embedded?<h2>{d.declTitle}</h2>:<h1>{d.declTitle}</h1>}<p>{d.declLead}</p></div></header>
    <section className="cabinet-card docs-checklist" aria-labelledby="docs-need-title">
      <h2 id="docs-need-title">{d.need}</h2>
      <ul>{checklist.map(item=><li key={item.label} className={item.ok?'ok':'todo'}>
        <span className="docs-check" aria-hidden="true">{item.ok?<Check size={14}/>:null}</span>
        <span className="docs-check-copy"><b>{item.label}</b>{item.detail&&<small>{item.detail}</small>}</span>
        {!item.ok&&('onAction' in item
          ?<button type="button" className="cabinet-text-btn" onClick={item.onAction}><Plus size={15} aria-hidden="true"/>{item.action}</button>
          :<Link className="cabinet-text-btn" href={item.href}>{item.action}<ArrowRight size={15} aria-hidden="true"/></Link>)}
      </li>)}</ul>
    </section>
    {readyToDeclare&&<div className="docs-declare">
      <section className="cabinet-card"><h2>{c.recipientData}</h2>{displayIdentity?<dl className="order-x-details"><div><dt>{c.recipientLabel}</dt><dd>{displayIdentity.lastName} {displayIdentity.firstName}</dd></div><div><dt>{c.birth}</dt><dd>{displayIdentity.birthDate}</dd></div><div><dt>{c.passportLabel}</dt><dd>{displayIdentity.passportMasked}</dd></div>{displayDelivery&&<div><dt>{c.address}</dt><dd>{displayDelivery.recipient}<small>{[displayDelivery.region, displayDelivery.city, displayDelivery.address, displayDelivery.postalCode].filter(Boolean).join(", ")}</small></dd></div>}</dl>:<p className="cabinet-empty">{c.notConfirmed}</p>}</section>
      <section className="cabinet-card docs-orders"><h2>{c.items}</h2>
        {groups.map(group=><div className="docs-group" key={group.key}>
          <div className="docs-group-head"><b>{d.ordersFor(group.name)}</b><button type="button" className="cabinet-text-btn" onClick={()=>setSelected(group.orders.map(order=>order.id))}>{d.selectGroup}</button></div>
          {group.orders.map(order=><label className="docs-order" key={order.id}><Checkbox checked={selected.includes(order.id)} onCheckedChange={value=>toggle(order,value===true)}/><span><b>{order.product.declarationDescription??order.product.name}</b><small>{order.id} · {order.product.country??(lang==='ru'?'Страна не указана':isUzbek(lang)?uzText(lang, 'Mamlakat ko‘rsatilmagan'):'Country not specified')} · {order.quantity} {lang==='ru'?'шт.':isUzbek(lang)?uzText(lang, 'dona'):'pcs'}</small></span><strong>{formatSum(order.quote.merchandise,lang)}</strong></label>)}
        </div>)}
        <div className="basket-total"><span>{c.value}</span><strong>{formatSum(total,lang)}</strong></div>
        {selectedOrders.length>0&&<p className={'lo-note'+(totalUsd>courierAllowanceUsd?' warn':'')}>{d.usd(totalUsd)}{totalUsd>courierAllowanceUsd?` · ${d.overLimit}`:''}</p>}
        <button type="button" className="btn primary basket-cta" disabled={busy||!displayIdentity||!displayDelivery||!selected.length} onClick={()=>void submit()}>{busy?<LoaderCircle className="spin" aria-hidden="true"/>:<FileCheck2 aria-hidden="true"/>}{c.create}</button>
        <p className="cabinet-note">{c.private}</p>
      </section>
    </div>}
    <section className="cabinet-card docs-history" aria-labelledby="docs-history-title"><h2 id="docs-history-title">{d.history}</h2>{state.declarations.length?<ul className="cabinet-rows">{state.declarations.map(item=><li key={item.id} className="docs-scan"><FileCheck2 aria-hidden="true"/><span><b>{item.id}</b><small>{formatDateTime(item.createdAt,lang)} · {orderCount(item.lines.length,lang)} · {c.draft}</small></span><strong>{formatSum(item.totalValue,lang)}</strong></li>)}</ul>:<p className="cabinet-empty">{c.noDrafts}</p>}</section>
    <Modal open={inline.open} onClose={inline.close} title={recipientCopy[lang].addTitle} description={recipientCopy[lang].note} locale={lang}>{inline.open&&<RecipientForm locale={lang} isFirst={!state.deliveryProfiles.length} onSave={inline.save}/>}</Modal>
  </div>;
}
