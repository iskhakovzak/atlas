'use client';
import {useCallback,useEffect,useId,useState,type FormEvent} from 'react';
import {Building2,Check,CreditCard,Globe2,Hash,ImagePlus,MessageSquareQuote,Plus,Trash2,TriangleAlert} from 'lucide-react';
import {toast} from 'sonner';
import {useMarket} from '@/lib/market/store';
import {paymentLabels,type PaymentMethod} from '@/lib/market/site-content';
import {siteContentDocumentSchema,siteContentIssues,siteContentMaxPhotos,siteContentMaxReviews,siteContentTextMax,type SiteContentDocumentInput,type SiteContentView} from '@/lib/market/site-content-schema';
import type {TextLocale} from '@/lib/market/i18n';

/**
 * The "Site content" admin tab: the owner fills the contacts, legal entity, payment methods, reviews,
 * parcel photos, the real count of delivered orders and the official prohibited-goods link here, not in code.
 * Saves go to POST /api/site-content with the document revision (CAS); a 409 reloads the current document.
 * Russian only, like the rest of the admin panel. Nothing here is a promise to customers: an empty block stays hidden.
 */
type Triple=Record<TextLocale,string>;
type Form={
  contacts:{telegramSupport:string;telegramChannel:string;phone:string;instagram:string;pickupAddress:Triple};
  legal:{entityName:string;inn:string;address:Triple};
  paymentMethods:PaymentMethod[];
  reviews:{key:string;name:string;city:string;text:Triple;consent:boolean}[];
  parcelPhotos:{key:string;src:string;alt:Triple}[];
  completedOrders:string;
  prohibitedListUrl:string;
};
const locales:{id:TextLocale;label:string}[]=[{id:'ru',label:'Русский'},{id:'uz',label:'O‘zbekcha'},{id:'en',label:'English'}];
const emptyTriple=():Triple=>({ru:'',uz:'',en:''});
const key=()=>Math.random().toString(36).slice(2,10);
function toForm(view:SiteContentView):Form{
  return {
    contacts:{telegramSupport:view.contacts.telegramSupport??'',telegramChannel:view.contacts.telegramChannel??'',phone:view.contacts.phone??'',instagram:view.contacts.instagram??'',pickupAddress:{...emptyTriple(),...(view.contacts.pickupAddress??{})}},
    legal:{entityName:view.legal.entityName??'',inn:view.legal.inn??'',address:{...emptyTriple(),...(view.legal.address??{})}},
    paymentMethods:[...view.paymentMethods],
    reviews:view.reviews.map(review=>({key:key(),name:review.name,city:review.city??'',text:{...emptyTriple(),...review.text},consent:true})),
    parcelPhotos:view.parcelPhotos.map(photo=>({key:key(),src:photo.src,alt:{...emptyTriple(),...photo.alt}})),
    completedOrders:view.completedOrders==null?'':String(view.completedOrders),
    prohibitedListUrl:view.prohibitedListUrl??'',
  };
}
/** The form → the document the server validates; '' becomes null, the consent box becomes the literal `true` only when ticked. */
function toDocument(form:Form,revision:number):SiteContentDocumentInput{
  const orNull=(value:string)=>value.trim()?value.trim():null;
  const trimmed=(triple:Triple):Triple=>({ru:triple.ru.trim(),uz:triple.uz.trim(),en:triple.en.trim()});
  return {
    revision,
    contacts:{telegramSupport:orNull(form.contacts.telegramSupport),telegramChannel:orNull(form.contacts.telegramChannel),phone:orNull(form.contacts.phone),instagram:orNull(form.contacts.instagram),pickupAddress:trimmed(form.contacts.pickupAddress)},
    legal:{entityName:orNull(form.legal.entityName),inn:orNull(form.legal.inn),address:trimmed(form.legal.address)},
    paymentMethods:form.paymentMethods,
    reviews:form.reviews.map(review=>({name:review.name,city:orNull(review.city),text:trimmed(review.text),...(review.consent?{consent:true as const}:{})})) as SiteContentDocumentInput['reviews'],
    parcelPhotos:form.parcelPhotos.map(photo=>({src:photo.src,alt:trimmed(photo.alt)})),
    completedOrders:form.completedOrders.trim()===''?null:Number(form.completedOrders),
    prohibitedListUrl:orNull(form.prohibitedListUrl),
  };
}
const fieldNames:Record<string,string>={
  'contacts.telegramSupport':'Telegram-бот поддержки','contacts.telegramChannel':'Telegram-канал','contacts.phone':'Телефон','contacts.instagram':'Instagram','contacts.pickupAddress':'Адрес пункта выдачи',
  'legal.entityName':'Юрлицо','legal.inn':'ИНН','legal.address':'Юридический адрес','paymentMethods':'Способы оплаты','reviews':'Отзывы','parcelPhotos':'Фото посылок','completedOrders':'Доставлено заказов','prohibitedListUrl':'Ссылка на перечень запрещённых товаров',
};
/** "reviews.0.consent: …" → "Отзывы №1 (consent): …" so the owner finds the field. */
function humanIssue(issue:string):string{
  const [path,...rest]=issue.split(': ');
  if(!rest.length)return issue;
  const parts=path.split('.');
  const head=parts.slice(0,2).join('.');
  const list=parts[0]==='reviews'||parts[0]==='parcelPhotos';
  const label=list?`${fieldNames[parts[0]]} №${Number(parts[1])+1}${parts[2]?` (${parts.slice(2).join('.')})`:''}`:(fieldNames[head]??fieldNames[parts[0]]??path);
  return `${label}: ${rest.join(': ')}`;
}
type Result={document?:SiteContentView;error?:string;errorCode?:string;issues?:string[]};

export function SiteContentAdmin(){
  const {siteContent,setSiteContent}=useMarket();
  const [form,setForm]=useState<Form>(()=>toForm(siteContent));
  const [revision,setRevision]=useState(siteContent.revision);
  const [updatedAt,setUpdatedAt]=useState<number|undefined>(siteContent.updatedAt);
  const [issues,setIssues]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const id=useId();
  const applyView=useCallback((view:SiteContentView)=>{setForm(toForm(view));setRevision(view.revision);setUpdatedAt(view.updatedAt);setDirty(false);setSiteContent(view)},[setSiteContent]);
  // The server render already carries the document; re-read it on mount so an admin who opened this tab later sees the latest revision.
  useEffect(()=>{let cancelled=false;void (async()=>{try{const r=await fetch('/api/site-content',{cache:'no-store'});const data=await r.json() as Result;if(!cancelled&&r.ok&&data.document)applyView(data.document)}catch{/* the server-rendered document stays */}})();return()=>{cancelled=true}},[applyView]);
  const update=(patch:(current:Form)=>Form)=>{setForm(current=>patch(current));setDirty(true)};
  const setContacts=(field:keyof Form['contacts'],value:string)=>update(f=>({...f,contacts:{...f.contacts,[field]:value}}));
  const setLegal=(field:keyof Form['legal'],value:string)=>update(f=>({...f,legal:{...f.legal,[field]:value}}));
  const setTriple=(path:'contacts.pickupAddress'|'legal.address',locale:TextLocale,value:string)=>update(f=>path==='contacts.pickupAddress'?{...f,contacts:{...f.contacts,pickupAddress:{...f.contacts.pickupAddress,[locale]:value}}}:{...f,legal:{...f.legal,address:{...f.legal.address,[locale]:value}}});
  const togglePayment=(method:PaymentMethod)=>update(f=>({...f,paymentMethods:f.paymentMethods.includes(method)?f.paymentMethods.filter(m=>m!==method):[...f.paymentMethods,method]}));
  const setReview=(k:string,patch:Partial<Form['reviews'][number]>)=>update(f=>({...f,reviews:f.reviews.map(r=>r.key===k?{...r,...patch}:r)}));
  const setReviewText=(k:string,locale:TextLocale,value:string)=>update(f=>({...f,reviews:f.reviews.map(r=>r.key===k?{...r,text:{...r.text,[locale]:value}}:r)}));
  const setPhoto=(k:string,patch:Partial<Form['parcelPhotos'][number]>)=>update(f=>({...f,parcelPhotos:f.parcelPhotos.map(p=>p.key===k?{...p,...patch}:p)}));
  const setPhotoAlt=(k:string,locale:TextLocale,value:string)=>update(f=>({...f,parcelPhotos:f.parcelPhotos.map(p=>p.key===k?{...p,alt:{...p.alt,[locale]:value}}:p)}));

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(saving)return;
    const document=toDocument(form,revision);
    const checked=siteContentDocumentSchema.safeParse(document);
    if(!checked.success){const list=siteContentIssues(checked.error).map(humanIssue);setIssues(list);toast.error('В контенте есть ошибки — см. список над кнопкой.');return}
    setIssues([]);setSaving(true);
    try{
      const r=await fetch('/api/site-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,document:checked.data})});
      let data:Result={};try{data=await r.json() as Result}catch{}
      if(r.status===409&&data.document){applyView(data.document);toast.warning(data.error??'Контент изменён в другой вкладке. Загружена актуальная версия.');return}
      if(!r.ok){if(data.issues?.length)setIssues(data.issues.map(humanIssue));toast.error(data.error??'Не удалось сохранить контент сайта.');return}
      if(data.document){applyView(data.document);toast.success('Контент сайта сохранён. Пустые блоки на сайте остаются скрытыми.')}
    }catch{toast.error('Сервер не ответил. Проверьте соединение и попробуйте снова.')}
    finally{setSaving(false)}
  };
  const reset=()=>{setForm(toForm(siteContent));setRevision(siteContent.revision);setIssues([]);setDirty(false)};
  const counter=(value:string)=>`${value.length}/${siteContentTextMax}`;

  // One text field with its "n/500" counter under the right edge; `multiline` renders a textarea.
  const textField=(fieldId:string,label:string,value:string,onChange:(value:string)=>void,options:{multiline?:boolean;max?:number;placeholder?:string;counter?:boolean}={})=>{
    const max=options.max??siteContentTextMax;
    return <div className="field sc-field" key={fieldId}>
      <label htmlFor={fieldId}>{label}</label>
      {options.multiline
        ?<textarea id={fieldId} rows={3} value={value} maxLength={max} onChange={e=>onChange(e.target.value)}/>
        :<input id={fieldId} value={value} maxLength={max} placeholder={options.placeholder} onChange={e=>onChange(e.target.value)}/>}
      {options.counter!==false&&<small className="sc-counter">{counter(value)}</small>}
    </div>;
  };
  const revisionLabel=`Ревизия ${revision}${updatedAt?` · ${new Date(updatedAt).toLocaleString('ru-RU')}`:''}`;
  const paymentMethods=Object.keys(paymentLabels) as PaymentMethod[];

  return <section className="surface admin-section site-content-admin">
    <div className="admin-section-head sc-head"><div><h2>Контент сайта</h2><p>Контакты, юрлицо, способы оплаты, отзывы и фото посылок на главной и в подвале. Заполняйте только проверенные данные: пустой блок на сайте не показывается, а выдуманный контакт или отзыв — это обман клиента.</p></div></div>
    <form onSubmit={submit} noValidate className="sc-form">
      <div className="sc-toolbar">
        <span className="sc-revision">{revisionLabel}{dirty&&<b className="sc-dirty">не сохранено</b>}</span>
        <div className="sc-toolbar-actions">
          <button type="button" className="btn secondary" disabled={saving||!dirty} onClick={reset}>Отменить изменения</button>
          <button type="submit" className="btn primary" disabled={saving||!dirty}>{saving?'Сохраняем…':'Сохранить контент сайта'}</button>
        </div>
      </div>

      <section className="sc-card" aria-labelledby={`${id}-h-contacts`}>
        <header className="sc-card-head"><Globe2 size={18} aria-hidden="true"/><h3 id={`${id}-h-contacts`}>Контакты</h3></header>
        <p className="sc-card-note">Telegram, телефон и Instagram показываются в блоке контактов на сайте. Указывайте имя без @ и без ссылки.</p>
        <div className="sc-grid">
          <div className="field sc-field"><label htmlFor={`${id}-tg-support`}>Telegram-бот поддержки (без @)</label><input id={`${id}-tg-support`} value={form.contacts.telegramSupport} onChange={e=>setContacts('telegramSupport',e.target.value)} placeholder="atlas_support_bot" autoComplete="off"/></div>
          <div className="field sc-field"><label htmlFor={`${id}-tg-channel`}>Telegram-канал (без @)</label><input id={`${id}-tg-channel`} value={form.contacts.telegramChannel} onChange={e=>setContacts('telegramChannel',e.target.value)} placeholder="atlas_uz" autoComplete="off"/></div>
          <div className="field sc-field"><label htmlFor={`${id}-phone`}>Телефон (+998 и 9 цифр)</label><input id={`${id}-phone`} type="tel" inputMode="tel" value={form.contacts.phone} onChange={e=>setContacts('phone',e.target.value)} placeholder="+998901234567" autoComplete="off"/></div>
          <div className="field sc-field"><label htmlFor={`${id}-instagram`}>Instagram (без @)</label><input id={`${id}-instagram`} value={form.contacts.instagram} onChange={e=>setContacts('instagram',e.target.value)} placeholder="atlas.uz" autoComplete="off"/></div>
        </div>
        <p className="sc-card-note">Адрес пункта выдачи в Ташкенте — на трёх языках или нигде. Это не склад за рубежом: сюда клиент приходит за посылкой.</p>
        <div className="sc-grid sc-grid-3">{locales.map(locale=>textField(`${id}-pickup-${locale.id}`,`Пункт выдачи · ${locale.label}`,form.contacts.pickupAddress[locale.id],value=>setTriple('contacts.pickupAddress',locale.id,value)))}</div>
      </section>

      <section className="sc-card" aria-labelledby={`${id}-h-legal`}>
        <header className="sc-card-head"><Building2 size={18} aria-hidden="true"/><h3 id={`${id}-h-legal`}>Юрлицо</h3></header>
        <p className="sc-card-note">Название и ИНН из регистрационных документов; юридический адрес — на трёх языках. Показываются в подвале сайта.</p>
        <div className="sc-grid">
          <div className="field sc-field"><label htmlFor={`${id}-entity`}>Название юрлица</label><input id={`${id}-entity`} value={form.legal.entityName} maxLength={200} onChange={e=>setLegal('entityName',e.target.value)} placeholder="ООО «…»"/></div>
          <div className="field sc-field"><label htmlFor={`${id}-inn`}>ИНН (9 цифр)</label><input id={`${id}-inn`} inputMode="numeric" value={form.legal.inn} maxLength={9} onChange={e=>setLegal('inn',e.target.value)}/></div>
        </div>
        <div className="sc-grid sc-grid-3">{locales.map(locale=>textField(`${id}-address-${locale.id}`,`Юридический адрес · ${locale.label}`,form.legal.address[locale.id],value=>setTriple('legal.address',locale.id,value)))}</div>
      </section>

      <section className="sc-card" aria-labelledby={`${id}-h-payments`}>
        <header className="sc-card-head"><CreditCard size={18} aria-hidden="true"/><h3 id={`${id}-h-payments`}>Способы оплаты</h3></header>
        <p className="sc-card-note sc-card-note-warn"><TriangleAlert size={14} aria-hidden="true"/><span>Отмечайте только реально подключённые провайдеры. Пока оплата в Atlas симулируется, список на сайте — это обещание, которое должно быть правдой.</span></p>
        <div className="sc-chips" role="group" aria-label="Показывать на главной">
          {paymentMethods.map(method=>{const checked=form.paymentMethods.includes(method);return <label key={method} className={checked?'sc-chip checked':'sc-chip'}><input type="checkbox" checked={checked} onChange={()=>togglePayment(method)}/>{checked&&<Check size={14} aria-hidden="true"/>}<span>{paymentLabels[method]}</span></label>})}
        </div>
      </section>

      <section className="sc-card" aria-labelledby={`${id}-h-reviews`}>
        <header className="sc-card-head"><MessageSquareQuote size={18} aria-hidden="true"/><h3 id={`${id}-h-reviews`}>Отзывы клиентов</h3><span className="sc-count">{form.reviews.length} / {siteContentMaxReviews}</span></header>
        <p className="sc-card-note">Только реальные отзывы и только с согласия клиента на публикацию. Текст нужен на трёх языках; до {siteContentMaxReviews} отзывов.</p>
        {form.reviews.length>0&&<div className="sc-items">
          {form.reviews.map((review,index)=><article className="sc-item" key={review.key} aria-label={`Отзыв №${index+1}`}>
            <header className="sc-item-head"><h4>Отзыв №{index+1}</h4><button type="button" className="btn secondary sc-item-delete" aria-label={`Удалить отзыв №${index+1}`} onClick={()=>update(f=>({...f,reviews:f.reviews.filter(r=>r.key!==review.key)}))}><Trash2 size={16} aria-hidden="true"/><span>Удалить</span></button></header>
            <div className="sc-grid">
              <div className="field sc-field"><label htmlFor={`${id}-review-${review.key}-name`}>Имя клиента</label><input id={`${id}-review-${review.key}-name`} value={review.name} maxLength={80} onChange={e=>setReview(review.key,{name:e.target.value})}/></div>
              <div className="field sc-field"><label htmlFor={`${id}-review-${review.key}-city`}>Город (необязательно)</label><input id={`${id}-review-${review.key}-city`} value={review.city} maxLength={80} onChange={e=>setReview(review.key,{city:e.target.value})}/></div>
            </div>
            <div className="sc-grid sc-grid-3">{locales.map(locale=>textField(`${id}-review-${review.key}-${locale.id}`,`Текст · ${locale.label}`,review.text[locale.id],value=>setReviewText(review.key,locale.id,value),{multiline:true}))}</div>
            <label className="sc-check"><input type="checkbox" checked={review.consent} onChange={e=>setReview(review.key,{consent:e.target.checked})}/><span>Клиент согласен на публикацию (обязательно)</span></label>
          </article>)}
        </div>}
        <div className="sc-card-actions"><button type="button" className="btn secondary" disabled={form.reviews.length>=siteContentMaxReviews} onClick={()=>update(f=>({...f,reviews:[...f.reviews,{key:key(),name:'',city:'',text:emptyTriple(),consent:false}]}))}><Plus size={16} aria-hidden="true"/><span>Добавить отзыв</span></button></div>
      </section>

      <section className="sc-card" aria-labelledby={`${id}-h-photos`}>
        <header className="sc-card-head"><ImagePlus size={18} aria-hidden="true"/><h3 id={`${id}-h-photos`}>Фото посылок</h3><span className="sc-count">{form.parcelPhotos.length} / {siteContentMaxPhotos}</span></header>
        <p className="sc-card-note">Фотографии реальных посылок. Файл кладётся в папку public/ сайта (например, public/parcels/2026-10.jpg), здесь указывается путь /parcels/2026-10.jpg и подпись на трёх языках; до {siteContentMaxPhotos} фото. Загрузки с чужих сайтов не принимаются.</p>
        {form.parcelPhotos.length>0&&<div className="sc-items">
          {form.parcelPhotos.map((photo,index)=><article className="sc-item" key={photo.key} aria-label={`Фото №${index+1}`}>
            <header className="sc-item-head"><h4>Фото №{index+1}</h4><button type="button" className="btn secondary sc-item-delete" aria-label={`Удалить фото №${index+1}`} onClick={()=>update(f=>({...f,parcelPhotos:f.parcelPhotos.filter(p=>p.key!==photo.key)}))}><Trash2 size={16} aria-hidden="true"/><span>Удалить</span></button></header>
            <div className="sc-grid">
              <div className="field sc-field sc-field-wide"><label htmlFor={`${id}-photo-${photo.key}-src`}>Путь к файлу в public/</label><input id={`${id}-photo-${photo.key}-src`} value={photo.src} maxLength={300} onChange={e=>setPhoto(photo.key,{src:e.target.value})} placeholder="/parcels/2026-10-01.jpg"/></div>
            </div>
            <div className="sc-grid sc-grid-3">{locales.map(locale=>textField(`${id}-photo-${photo.key}-${locale.id}`,`Подпись · ${locale.label}`,photo.alt[locale.id],value=>setPhotoAlt(photo.key,locale.id,value)))}</div>
          </article>)}
        </div>}
        <div className="sc-card-actions"><button type="button" className="btn secondary" disabled={form.parcelPhotos.length>=siteContentMaxPhotos} onClick={()=>update(f=>({...f,parcelPhotos:[...f.parcelPhotos,{key:key(),src:'',alt:emptyTriple()}]}))}><Plus size={16} aria-hidden="true"/><span>Добавить фото</span></button></div>
      </section>

      <section className="sc-card" aria-labelledby={`${id}-h-numbers`}>
        <header className="sc-card-head"><Hash size={18} aria-hidden="true"/><h3 id={`${id}-h-numbers`}>Цифры и ссылки</h3></header>
        <p className="sc-card-note">Счётчик доставленных заказов и официальный перечень запрещённых к ввозу товаров. Пустое поле — блок на сайте скрыт.</p>
        <div className="sc-grid">
          <div className="field sc-field"><label htmlFor={`${id}-completed`}>Доставлено заказов (только реальные)</label><input id={`${id}-completed`} type="number" inputMode="numeric" min={0} step={1} value={form.completedOrders} onChange={e=>update(f=>({...f,completedOrders:e.target.value}))} placeholder="пусто — блок скрыт"/><small className="sc-hint">Симулированные и тестовые заказы не считаются.</small></div>
          <div className="field sc-field"><label htmlFor={`${id}-prohibited`}>Перечень запрещённых к ввозу товаров (https://)</label><input id={`${id}-prohibited`} type="url" inputMode="url" value={form.prohibitedListUrl} maxLength={500} onChange={e=>update(f=>({...f,prohibitedListUrl:e.target.value}))} placeholder="https://…"/><small className="sc-hint">Только официальная страница таможенного органа.</small></div>
        </div>
      </section>

      {issues.length>0&&<div className="catalog-issues sc-issues" role="alert"><b>Исправьте перед сохранением:</b><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
      <div className="sc-toolbar sc-toolbar-bottom">
        <span className="sc-revision">{revisionLabel}</span>
        <div className="sc-toolbar-actions">
          <button type="button" className="btn secondary" disabled={saving||!dirty} onClick={reset}>Отменить изменения</button>
          <button type="submit" className="btn primary" disabled={saving||!dirty}>{saving?'Сохраняем…':'Сохранить контент сайта'}</button>
        </div>
        <p className="sc-footnote">Сохранение пишется в журнал действий. Если контент одновременно меняли в другой вкладке, подгрузится актуальная версия — проверьте поля и сохраните снова.</p>
      </div>
    </form>
  </section>;
}
