"use client";
import {capitalizeWords} from "@/lib/market/text-case";

import {useEffect,useMemo,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "@/components/site-link";
import {Checkbox} from "@/components/ui/checkbox";
import {AlertTriangle,ArrowRight,Check,FileCheck2,FileText,LoaderCircle,Plus,ScanLine,ShieldCheck,Trash2,Upload} from "lucide-react";
import {toast} from "sonner";
import {useMarket} from "@/lib/market/store";
import {formatSum} from "@/lib/market/home-copy";
import {docsCopy,formatDateTime,formatLongDate,orderCount,recipientCopy} from "@/lib/market/customer-copy";
import {courierAllowanceUsd} from "@/lib/market/customs";
import {Empty,Modal} from "./market-ui";
import {RecipientForm,type RecipientDraft} from "./recipient-form";
import {normalizeDocument,readDocument} from "./passport-ocr";

type DocumentRow={id:string;filename:string;content_type?:string;contentType?:string;size:number;status:string;created_at?:number;createdAt?:number};
type IdentityForm={firstName:string;lastName:string;birthDate:string;passportNumber:string;nationality:string};
const empty:IdentityForm={firstName:"",lastName:"",birthDate:"",passportNumber:"",nationality:""};

/** Adds a recipient from a document page, then selects it once the saved state comes back. */
function useInlineRecipient(onAdded:(id:string)=>void){
  const {state,act}=useMarket();
  const [open,setOpen]=useState(false);
  const pending=useRef<string|null>(null);
  useEffect(()=>{
    const key=pending.current;if(!key)return;
    const added=state.deliveryProfiles.find(profile=>`${profile.recipient}|${profile.address}`===key);
    if(added){pending.current=null;queueMicrotask(()=>onAdded(added.id))}
  },[state.deliveryProfiles,onAdded]);
  async function save(value:RecipientDraft){
    pending.current=`${value.profile.recipient}|${value.profile.address}`;
    if(await act({type:'delivery-profile-save',value:value.profile,label:value.label,primary:value.primary})){setOpen(false);toast.success(recipientCopy[state.communication.language].saved)}
    else pending.current=null;
  }
  return {open,setOpen,save};
}

export function IdentityView(){
  const {state,user,ready,act}=useMarket();
  const lang=state.communication.language;
  const c={ru:{notReady:'Войдите, чтобы подтвердить личность',notReadyText:'Скан и подтверждённые данные доступны только владельцу профиля.',open:'Открыть вход',over:'ЗАЩИЩЁННЫЕ ДОКУМЕНТЫ',title:'Паспорт для декларации.',intro:'Загрузите разворот с фото. Atlas попробует прочитать машиночитаемую зону, а вы обязательно проверите результат.',replace:'Заменить документ',uploadTitle:'Загрузите паспорт',how:'Как сфотографировать паспорт',howText:'JPG, PNG или PDF до 8 МБ. Чёткое фото без бликов, весь разворот и две строки внизу документа. Распознавание выполняется автоматически на вашем устройстве, без сторонних сервисов и ИИ, и может содержать ошибки — проверьте каждое поле.',choose:'Выбрать файл или фото',consent:'Согласен на',processing:'обработку паспортных данных',recognize:'Распознать и загрузить',private:'Изображение доступно только вашему аккаунту. Его можно удалить ниже.',check:'Проверьте данные',after:'После загрузки здесь появятся распознанные поля.',last:'Фамилия',first:'Имя',birth:'Дата рождения',nationality:'Гражданство / код',number:'Номер паспорта',confirmed:'Подтверждено',confirm:'Подтверждаю, данные верны',docs:'Загруженные документы',confirmedData:'данные подтверждены',pending:'ожидает подтверждения',delete:'Удалить скан',none:'Сканов пока нет.',warning:'Atlas не выполняет государственную проверку документа и не отправляет его в таможню автоматически.'},uz:{notReady:'Shaxsni tasdiqlash uchun kiring',notReadyText:'Skan va tasdiqlangan ma’lumotlar faqat profil egasiga ko‘rinadi.',open:'Kirishni ochish',over:'HIMOYALANGAN HUJJATLAR',title:'Deklaratsiya uchun pasport.',intro:'Suratli sahifani yuklang. Atlas MRZ zonasini o‘qishga harakat qiladi, natijani esa siz tekshirasiz.',replace:'Hujjatni almashtirish',uploadTitle:'Pasportni yuklang',how:'Pasportni qanday suratga olish kerak',howText:'JPG, PNG yoki PDF, 8 MB gacha. Yaltiroqsiz aniq surat, to‘liq yoyilma va pastdagi ikki qator. Tanib olish avtomatik ravishda qurilmangizda, tashqi xizmatlar va sun’iy intellektsiz bajariladi va xato bo‘lishi mumkin — har bir maydonni tekshiring.',choose:'Fayl yoki suratni tanlang',consent:'Men roziman:',processing:'pasport ma’lumotlarini qayta ishlashga',recognize:'Tanib olish va yuklash',private:'Rasm faqat akkauntingizga ochiq. Uni quyida o‘chirishingiz mumkin.',check:'Ma’lumotlarni tekshiring',after:'Yuklangandan so‘ng tanilgan maydonlar shu yerda paydo bo‘ladi.',last:'Familiya',first:'Ism',birth:'Tug‘ilgan sana',nationality:'Fuqarolik / kod',number:'Pasport raqami',confirmed:'Tasdiqlangan',confirm:'Ma’lumotlar to‘g‘ri',docs:'Yuklangan hujjatlar',confirmedData:'ma’lumotlar tasdiqlangan',pending:'tasdiq kutilmoqda',delete:'Skanerlangan nusxani o‘chirish',none:'Hali skanlar yo‘q.',warning:'Atlas hujjatni davlat tomonidan tekshirmaydi va uni bojxonaga avtomatik yubormaydi.'},en:{notReady:'Sign in to confirm your identity',notReadyText:'Scans and confirmed details are available only to the profile owner.',open:'Open sign in',over:'PROTECTED DOCUMENTS',title:'Passport for your declaration.',intro:'Upload the photo page. Atlas will try to read the machine-readable zone, and you must verify the result.',replace:'Replace document',uploadTitle:'Upload your passport',how:'How to photograph your passport',howText:'JPG, PNG or PDF up to 8 MB. Use a clear, glare-free photo of the full spread and the two lines at the bottom. Recognition runs automatically on your device, without any third-party service or AI, and may contain mistakes — check every field.',choose:'Choose a file or photo',consent:'I agree to',processing:'passport data processing',recognize:'Read and upload',private:'The image is available only to your account. You can delete it below.',check:'Check the details',after:'Recognized fields will appear here after upload.',last:'Last name',first:'First name',birth:'Date of birth',nationality:'Nationality / code',number:'Passport number',confirmed:'Confirmed',confirm:'The details are correct',docs:'Uploaded documents',confirmedData:'details confirmed',pending:'awaiting confirmation',delete:'Delete scan',none:'No scans yet.',warning:'Atlas does not perform government document verification and does not send it to customs automatically.'}}[lang];
  const d=docsCopy[lang];
  const requested=useSearchParams().get('recipient')??'';
  const [reading,setReading]=useState(false);
  const [docs,setDocs]=useState<DocumentRow[]>([]),[file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false),[form,setForm]=useState<IdentityForm>(empty),[busy,setBusy]=useState(false),[documentId,setDocumentId]=useState(""),[recipientProfileId,setRecipientProfileId]=useState("");
  const recipientProfiles=state.deliveryProfiles;
  const identities=useMemo(()=>state.identityProfiles??(state.identityProfile?[state.identityProfile]:[]),[state.identityProfiles,state.identityProfile]);
  // A link from the account ("add passport" on a recipient) preselects that recipient.
  const selectedRecipientProfileId=recipientProfileId||(recipientProfiles.some(profile=>profile.id===requested)?requested:'')||((recipientProfiles.find(profile=>profile.primary)??recipientProfiles[0])?.id??"");
  const inline=useInlineRecipient(id=>{setRecipientProfileId(id);setForm(empty)});
  useEffect(()=>{if(!user)return;void fetch('/api/passport',{cache:'no-store'}).then(async r=>{const data=await r.json() as {documents?:DocumentRow[];error?:string};if(!r.ok)throw Error(data.error??d.loadError);setDocs(data.documents??[]);const pending=(data.documents??[]).find(doc=>doc.status!=='confirmed'&&!identities.some(identity=>identity.documentId===doc.id));if(pending)setDocumentId(pending.id)}).catch(e=>toast.error((e as Error).message))},[user,identities,d.loadError]);
  const current=identities.find(profile=>profile.recipientProfileId===selectedRecipientProfileId);
  async function upload(){
    if(!file||!consent||busy)return;setBusy(true);
    try{
      let extracted:Partial<IdentityForm>={};
      // iPhone HEIC and very large photos become a JPEG first; the reading happens in this browser (/ocr/).
      const prepared=await normalizeDocument(file).catch(()=>file);
      setReading(true);
      try{const found=await readDocument(prepared);extracted=Object.fromEntries(Object.entries({firstName:found.firstName,lastName:found.lastName,birthDate:found.birthDate,passportNumber:found.passportNumber,nationality:found.nationality}).filter(([,value])=>value)) as Partial<IdentityForm>;if(prepared.type.startsWith('image/')&&!Object.keys(extracted).length)toast.message(d.autoFailed)}catch{toast.message(d.autoFailed)}
      finally{setReading(false)}
      const body=new FormData();body.append('file',prepared);const response=await fetch('/api/passport',{method:'POST',body});const data=await response.json() as {document?:DocumentRow;error?:string};if(!response.ok||!data.document)throw Error(data.error??d.uploadError);
      setDocs(list=>[data.document!,...list]);setDocumentId(data.document.id);setForm({...empty,...extracted});toast.success(Object.keys(extracted).length?d.uploadedFilled:d.uploaded);
    }catch(error){toast.error((error as Error).message)}finally{setBusy(false)}
  }
  async function confirm(){if(!documentId||!selectedRecipientProfileId)return;setBusy(true);const ok=await act({type:'identity-confirm',documentId,recipientProfileId:selectedRecipientProfileId,...form});setBusy(false);if(ok)toast.success(d.confirmedToast)}
  async function remove(id:string){if(!window.confirm(d.deleteConfirm))return;setBusy(true);try{const response=await fetch('/api/passport?id='+encodeURIComponent(id),{method:'DELETE'});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error??d.deleteError);if(identities.some(identity=>identity.documentId===id))await act({type:'identity-clear',documentId:id});setDocs(list=>list.filter(doc=>doc.id!==id));if(documentId===id)setDocumentId('');toast.success(d.deleted)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
  if(!ready)return <Empty title={c.notReady} description={c.notReadyText} href="/account" label={c.open}/>;
  return <div className="docs-page">
    <header className="orders-head"><div><h1>{d.title}</h1><p>{d.lead}</p></div></header>
    <ol className="docs-steps">
      <li className="cabinet-card docs-step">
        <h2><span className="docs-num" aria-hidden="true">1</span>{d.whose}</h2>
        <p className="cabinet-lead">{d.whoseHint}</p>
        {recipientProfiles.length?<div className="docs-recipients" role="radiogroup" aria-label={d.whose}>{recipientProfiles.map(profile=>{
          const passport=identities.find(identity=>identity.recipientProfileId===profile.id),checked=profile.id===selectedRecipientProfileId;
          return <label key={profile.id} className={'docs-recipient'+(checked?' selected':'')}>
            <input type="radio" name="passport-recipient" value={profile.id} checked={checked} onChange={()=>{setRecipientProfileId(profile.id);setForm(empty)}}/>
            <span className="docs-recipient-copy"><b>{profile.recipient}</b><small>{profile.label}</small></span>
            <span className={'cabinet-chip '+(passport?'ok':'warn')}>{passport?<Check size={14} aria-hidden="true"/>:null}{passport?d.passportOk(passport.passportMasked):d.passportMissing}</span>
          </label>;
        })}</div>:<p className="cabinet-empty">{d.noRecipient}</p>}
        <button type="button" className="cabinet-add" onClick={()=>inline.setOpen(true)}><Plus size={18} aria-hidden="true"/>{d.addRecipient}</button>
      </li>
      <li className={'cabinet-card docs-step'+(selectedRecipientProfileId?'':' muted')}>
        <h2><span className="docs-num" aria-hidden="true">2</span>{documentId||current?d.replaceStep:d.uploadStep}</h2>
        <details className="docs-how"><summary>{c.how}</summary><p>{c.howText}</p></details>
        <label className="docs-drop"><Upload aria-hidden="true"/><span>{file?file.name:c.choose}</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setFile(event.target.files?.[0]??null)}/></label>
        <div className="basket-consent"><Checkbox id="passport-consent" checked={consent} onCheckedChange={value=>setConsent(value===true)}/><label htmlFor="passport-consent">{c.consent} <Link href="/legal#passport-consent" target="_blank" rel="noopener noreferrer">{c.processing}</Link>.</label></div>
        <button type="button" className="btn primary basket-cta" disabled={!file||!consent||busy||!selectedRecipientProfileId} onClick={()=>void upload()}>{busy?<LoaderCircle className="spin" aria-hidden="true"/>:<ScanLine aria-hidden="true"/>}{reading?d.reading:c.recognize}</button>
        <p className="cabinet-note">{selectedRecipientProfileId?c.private:d.pickFirst}</p>
      </li>
      <li className="cabinet-card docs-step">
        <h2><span className="docs-num" aria-hidden="true">3</span>{d.checkStep}</h2>
        {!selectedRecipientProfileId?<p className="cabinet-empty">{d.pickFirst}</p>:!documentId&&!current?<div className="docs-placeholder"><FileText aria-hidden="true"/><p>{c.after}</p></div>:<div className="docs-fields">
          <div className="rf-row"><div className="rf-field"><label htmlFor="last-name">{c.last}</label><input id="last-name" required autoComplete="family-name" autoCapitalize="words" value={form.lastName||(current?.lastName??"")} onChange={e=>setForm({...form,lastName:capitalizeWords(e.target.value)})}/></div><div className="rf-field"><label htmlFor="first-name">{c.first}</label><input id="first-name" required autoComplete="given-name" autoCapitalize="words" value={form.firstName||(current?.firstName??"")} onChange={e=>setForm({...form,firstName:capitalizeWords(e.target.value)})}/></div></div>
          <div className="rf-row"><div className="rf-field"><label htmlFor="birth-date">{c.birth}</label><input id="birth-date" type="date" required value={form.birthDate||(current?.birthDate??"")} onChange={e=>setForm({...form,birthDate:e.target.value})}/></div><div className="rf-field"><label htmlFor="nationality">{c.nationality}</label><input id="nationality" value={form.nationality||(current?.nationality??"")} onChange={e=>setForm({...form,nationality:e.target.value})}/></div></div>
          <div className="rf-field"><label htmlFor="passport-number">{c.number}</label><input id="passport-number" required minLength={6} maxLength={24} autoComplete="off" value={form.passportNumber} placeholder={current?.passportMasked??"AA 1234567"} onChange={e=>setForm({...form,passportNumber:e.target.value})}/></div>
          {current&&<p className="lo-note"><Check size={16} aria-hidden="true"/>{c.confirmed} {formatLongDate(current.confirmedAt,lang)}: {current.lastName} {current.firstName}, {current.birthDate}, {current.passportMasked}</p>}
          <button type="button" className="btn primary basket-cta" disabled={!documentId||!selectedRecipientProfileId||busy||!form.firstName||!form.lastName||!form.birthDate||!form.passportNumber} onClick={()=>void confirm()}><ShieldCheck aria-hidden="true"/>{c.confirm}</button>
        </div>}
      </li>
    </ol>
    <section className="cabinet-card docs-scans" aria-labelledby="docs-scans-title"><h2 id="docs-scans-title">{d.scans}</h2>{docs.length?<ul className="cabinet-rows">{docs.map(doc=>{const identity=identities.find(item=>item.documentId===doc.id);const recipient=recipientProfiles.find(item=>item.id===identity?.recipientProfileId);return <li key={doc.id} className="docs-scan"><FileCheck2 aria-hidden="true"/><span><b>{doc.filename}</b><small>{Math.ceil(doc.size/1024)} KB · {doc.status==='confirmed'?c.confirmedData:c.pending}{recipient?` · ${recipient.recipient}`:''}</small></span><button type="button" className="icon-btn" aria-label={`${c.delete}: ${doc.filename}`} disabled={busy} onClick={()=>void remove(doc.id)}><Trash2 aria-hidden="true"/></button></li>})}</ul>:<p className="cabinet-empty">{c.none}</p>}<p className="lo-note warn"><AlertTriangle size={16} aria-hidden="true"/>{c.warning}</p></section>
    <Modal open={inline.open} onClose={()=>inline.setOpen(false)} title={recipientCopy[lang].addTitle} description={recipientCopy[lang].note} locale={lang}>{inline.open&&<RecipientForm locale={lang} isFirst={!recipientProfiles.length} onSave={inline.save}/>}</Modal>
  </div>;
}

export function DeclarationView(){
  const {state,ready,act,pricing}=useMarket();const eligible=state.orders.filter(order=>!order.cancelled);const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const identities=state.identityProfiles??(state.identityProfile?[state.identityProfile]:[]);
  const selectedOrders=eligible.filter(order=>selected.includes(order.id));
  const referenceOrder=selectedOrders[0];
  const recipientKey=referenceOrder?.deliveryProfileId??"legacy";
  const recipientProfile=referenceOrder?.deliveryProfileId?state.deliveryProfiles.find(profile=>profile.id===referenceOrder.deliveryProfileId):(state.deliveryProfiles.find(profile=>profile.primary)??state.deliveryProfiles[0]);
  const displayIdentity=referenceOrder?.identity??identities.find(profile=>profile.recipientProfileId===recipientProfile?.id)??state.identityProfile;
  const displayDelivery=referenceOrder?.delivery??recipientProfile??state.deliveryProfile;
  const lang=state.communication.language;
  const c=lang==='ru'?{over:'ТАМОЖЕННЫЙ ПАКЕТ',title:'Декларация без повторного ввода.',intro:'Atlas подставляет только подтверждённые паспортные данные, адрес и сведения из выбранных заказов.',login:'Войдите, чтобы открыть декларации',loginText:'Документы привязаны к вашему профилю Atlas.',open:'Открыть вход',docs:'ДОКУМЕНТЫ',draftTitle:'Декларация',draftIntro:'Подготовим черновик из ваших заказов.',passport:'Подтвердите паспорт',recipient:'Добавьте получателя',checkDoc:'Проверьте данные документа, чтобы продолжить.',saveAddress:'Сохраните адрес доставки в профиле.',checkPassport:'Проверить паспорт',addAddress:'Добавить адрес',recipientData:'Данные получателя',recipientLabel:'Получатель',birth:'Дата рождения',passportLabel:'Паспорт',notConfirmed:'Паспортные данные не подтверждены.',address:'Адрес',items:'Товары в пакете',selectAll:'Выбрать все заказы',noOrders:'Сначала оформите хотя бы один заказ.',value:'Стоимость товаров',create:'Создать черновик',private:'Пакет сохраняется только в Atlas. Передача государственным органам не выполняется.',history:'История пакетов',noDrafts:'Черновиков пока нет.',draft:'черновик',sent:'Пакет декларации подготовлен'}:{over:lang==='uz'?'BOJXONA PAKETI':'CUSTOMS PACKAGE',title:lang==='uz'?'Qayta kiritmasdan deklaratsiya.':'Declaration without re-entry.',intro:lang==='uz'?'Atlas faqat tasdiqlangan pasport, manzil va tanlangan buyurtma ma’lumotlarini qo‘shadi.':'Atlas uses only confirmed passport details, your address and selected order data.',login:lang==='uz'?'Deklaratsiyalarni ochish uchun kiring':'Sign in to open declarations',loginText:lang==='uz'?'Hujjatlar Atlas profilingizga bog‘langan.':'Documents are tied to your Atlas profile.',open:lang==='uz'?'Kirishni ochish':'Open sign in',docs:lang==='uz'?'HUJJATLAR':'DOCUMENTS',draftTitle:lang==='uz'?'Deklaratsiya':'Declaration',draftIntro:lang==='uz'?'Buyurtmalaringizdan qoralama tayyorlaymiz.':'We will prepare a draft from your orders.',passport:lang==='uz'?'Pasportni tasdiqlang':'Confirm your passport',recipient:lang==='uz'?'Qabul qiluvchini qo‘shing':'Add a recipient',checkDoc:lang==='uz'?'Davom etish uchun hujjat ma’lumotlarini tekshiring.':'Check the document details to continue.',saveAddress:lang==='uz'?'Profilingizda yetkazish manzilini saqlang.':'Save a delivery address in your profile.',checkPassport:lang==='uz'?'Pasportni tekshirish':'Check passport',addAddress:lang==='uz'?'Manzil qo‘shish':'Add address',recipientData:lang==='uz'?'Qabul qiluvchi ma’lumotlari':'Recipient details',recipientLabel:lang==='uz'?'Qabul qiluvchi':'Recipient',birth:lang==='uz'?'Tug‘ilgan sana':'Date of birth',passportLabel:lang==='uz'?'Pasport':'Passport',notConfirmed:lang==='uz'?'Pasport ma’lumotlari tasdiqlanmagan.':'Passport details are not confirmed.',address:lang==='uz'?'Manzil':'Address',items:lang==='uz'?'Paketdagi tovarlar':'Items in the package',selectAll:lang==='uz'?'Barcha buyurtmalarni tanlash':'Select all orders',noOrders:lang==='uz'?'Avval kamida bitta buyurtma yarating.':'Create at least one order first.',value:lang==='uz'?'Tovarlar qiymati':'Item value',create:lang==='uz'?'Qoralama yaratish':'Create draft',private:lang==='uz'?'Paket faqat Atlasda saqlanadi. Davlat organlariga uzatilmaydi.':'The package is stored only in Atlas. It is not sent to government authorities.',history:lang==='uz'?'Paketlar tarixi':'Package history',noDrafts:lang==='uz'?'Hali qoralamalar yo‘q.':'No drafts yet.',draft:lang==='uz'?'qoralama':'draft',sent:lang==='uz'?'Deklaratsiya paketi tayyorlandi':'Declaration package prepared'};
  const d=docsCopy[lang];
  const total=selectedOrders.reduce((sum,order)=>sum+order.quote.merchandise,0);
  const totalUsd=Math.round(selectedOrders.reduce((sum,order)=>sum+order.quote.merchandise/(order.quote.fx??pricing.fx),0));
  // Orders are grouped the way the server checks them: one declaration per saved recipient.
  const groups=[...eligible.reduce((map,order)=>{const key=order.deliveryProfileId??"legacy";const list=map.get(key)??[];list.push(order);return map.set(key,list)},new Map<string,typeof eligible>())].map(([key,orders])=>{
    const profile=key==="legacy"?undefined:state.deliveryProfiles.find(item=>item.id===key);
    return {key,orders,name:profile?.recipient??orders[0].delivery?.recipient??c.recipientLabel};
  });
  const primary=state.deliveryProfiles.find(profile=>profile.primary)??state.deliveryProfiles[0];
  const checklist=[
    {ok:state.deliveryProfiles.length>0,label:d.needRecipient,detail:primary?.recipient,href:"/account",action:recipientCopy[lang].addTitle},
    {ok:identities.length>0,label:d.needPassport,detail:identities[0]?.passportMasked,href:primary?`/identity?recipient=${encodeURIComponent(primary.id)}`:"/identity",action:d.addPassport},
    {ok:eligible.length>0,label:d.needOrders,detail:eligible.length?orderCount(eligible.length,lang):undefined,href:"/order-by-link",action:d.newOrder},
  ];
  const readyToDeclare=checklist.every(item=>item.ok);
  async function submit(){setBusy(true);const ok=await act({type:'declaration-preview',orderIds:selected});setBusy(false);if(ok)toast.success(c.sent)}
  function toggle(order:(typeof eligible)[number],value:boolean){
    const key=order.deliveryProfileId??"legacy";
    if(value&&selectedOrders.length&&key!==recipientKey){toast.error(lang==='ru'?'Для разных получателей нужны отдельные декларации.':lang==='uz'?'Turli qabul qiluvchilar uchun alohida deklaratsiya kerak.':'Create separate declarations for different recipients.');return}
    setSelected(list=>value?[...new Set([...list,order.id])]:list.filter(id=>id!==order.id));
  }
  if(!ready)return <Empty title={c.login} description={c.loginText} href="/account" label={c.open}/>;
  return <div className="docs-page">
    <header className="orders-head"><div><h1>{d.declTitle}</h1><p>{d.declLead}</p></div></header>
    <section className="cabinet-card docs-checklist" aria-labelledby="docs-need-title">
      <h2 id="docs-need-title">{d.need}</h2>
      <ul>{checklist.map(item=><li key={item.label} className={item.ok?'ok':'todo'}>
        <span className="docs-check" aria-hidden="true">{item.ok?<Check size={14}/>:null}</span>
        <span className="docs-check-copy"><b>{item.label}</b>{item.detail&&<small>{item.detail}</small>}</span>
        {!item.ok&&<Link className="cabinet-text-btn" href={item.href}>{item.action}<ArrowRight size={15} aria-hidden="true"/></Link>}
      </li>)}</ul>
    </section>
    {readyToDeclare&&<div className="docs-declare">
      <section className="cabinet-card"><h2>{c.recipientData}</h2>{displayIdentity?<dl className="order-x-details"><div><dt>{c.recipientLabel}</dt><dd>{displayIdentity.lastName} {displayIdentity.firstName}</dd></div><div><dt>{c.birth}</dt><dd>{displayIdentity.birthDate}</dd></div><div><dt>{c.passportLabel}</dt><dd>{displayIdentity.passportMasked}</dd></div>{displayDelivery&&<div><dt>{c.address}</dt><dd>{displayDelivery.recipient}<small>{[displayDelivery.region, displayDelivery.city, displayDelivery.address, displayDelivery.postalCode].filter(Boolean).join(", ")}</small></dd></div>}</dl>:<p className="cabinet-empty">{c.notConfirmed}</p>}</section>
      <section className="cabinet-card docs-orders"><h2>{c.items}</h2>
        {groups.map(group=><div className="docs-group" key={group.key}>
          <div className="docs-group-head"><b>{d.ordersFor(group.name)}</b><button type="button" className="cabinet-text-btn" onClick={()=>setSelected(group.orders.map(order=>order.id))}>{d.selectGroup}</button></div>
          {group.orders.map(order=><label className="docs-order" key={order.id}><Checkbox checked={selected.includes(order.id)} onCheckedChange={value=>toggle(order,value===true)}/><span><b>{order.product.declarationDescription??order.product.name}</b><small>{order.id} · {order.product.country??(lang==='ru'?'Страна не указана':lang==='uz'?'Mamlakat ko‘rsatilmagan':'Country not specified')} · {order.quantity} {lang==='ru'?'шт.':lang==='uz'?'dona':'pcs'}</small></span><strong>{formatSum(order.quote.merchandise,lang)}</strong></label>)}
        </div>)}
        <div className="basket-total"><span>{c.value}</span><strong>{formatSum(total,lang)}</strong></div>
        {selectedOrders.length>0&&<p className={'lo-note'+(totalUsd>courierAllowanceUsd?' warn':'')}>{d.usd(totalUsd)}{totalUsd>courierAllowanceUsd?` · ${d.overLimit}`:''}</p>}
        <button type="button" className="btn primary basket-cta" disabled={busy||!displayIdentity||!displayDelivery||!selected.length} onClick={()=>void submit()}>{busy?<LoaderCircle className="spin" aria-hidden="true"/>:<FileCheck2 aria-hidden="true"/>}{c.create}</button>
        <p className="cabinet-note">{c.private}</p>
      </section>
    </div>}
    <section className="cabinet-card docs-history" aria-labelledby="docs-history-title"><h2 id="docs-history-title">{d.history}</h2>{state.declarations.length?<ul className="cabinet-rows">{state.declarations.map(item=><li key={item.id} className="docs-scan"><FileCheck2 aria-hidden="true"/><span><b>{item.id}</b><small>{formatDateTime(item.createdAt,lang)} · {orderCount(item.lines.length,lang)} · {c.draft}</small></span><strong>{formatSum(item.totalValue,lang)}</strong></li>)}</ul>:<p className="cabinet-empty">{c.noDrafts}</p>}</section>
  </div>;
}
