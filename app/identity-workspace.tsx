"use client";

import {useEffect,useState} from "react";
import Link from "@/components/site-link";
import {Checkbox} from "@/components/ui/checkbox";
import {AlertTriangle,Check,FileCheck2,FileText,LoaderCircle,ScanLine,ShieldCheck,Trash2,Upload} from "lucide-react";
import {toast} from "sonner";
import {money} from "@/lib/market/domain";
import {useMarket} from "@/lib/market/store";
import {Empty,PageHeading} from "./market-ui";

type DocumentRow={id:string;filename:string;content_type?:string;contentType?:string;size:number;status:string;created_at?:number;createdAt?:number};
type IdentityForm={firstName:string;lastName:string;birthDate:string;passportNumber:string;nationality:string};
const empty:IdentityForm={firstName:"",lastName:"",birthDate:"",passportNumber:"",nationality:""};

function birthDate(value:string){
  if(!/^\d{6}$/.test(value))return "";
  const yy=Number(value.slice(0,2)),current=new Date().getFullYear()%100,year=yy>current?1900+yy:2000+yy;
  return `${year}-${value.slice(2,4)}-${value.slice(4,6)}`;
}
export function parseMrz(text:string):Partial<IdentityForm>{
  const lines=text.toUpperCase().split(/\r?\n/).map(line=>line.replace(/[^A-Z0-9<]/g,"")).filter(line=>line.length>=35);
  const first=lines.find(line=>line.startsWith("P<"));
  const second=first?lines[lines.indexOf(first)+1]:undefined;
  if(!first||!second)return {};
  const names=first.slice(5).split("<<"),lastName=(names[0]??"").replaceAll("<"," ").trim(),firstName=(names[1]??"").replaceAll("<"," ").trim();
  return {lastName,firstName,passportNumber:second.slice(0,9).replaceAll("<",""),nationality:second.slice(10,13).replaceAll("<",""),birthDate:birthDate(second.slice(13,19))};
}

async function readImage(file:File){
  const Detector=(window as unknown as {TextDetector?:new()=>{detect:(source:ImageBitmap)=>Promise<Array<{rawValue:string}>>}}).TextDetector;
  if(!Detector||!file.type.startsWith("image/"))return null;
  const bitmap=await createImageBitmap(file),blocks=await new Detector().detect(bitmap);bitmap.close();
  return blocks.map(block=>block.rawValue).join("\n");
}

export function IdentityView(){
  const {state,user,ready,act}=useMarket();
  const [docs,setDocs]=useState<DocumentRow[]>([]),[file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false),[form,setForm]=useState<IdentityForm>(empty),[busy,setBusy]=useState(false),[documentId,setDocumentId]=useState("");
  useEffect(()=>{if(!user)return;void fetch('/api/passport',{cache:'no-store'}).then(async r=>{const data=await r.json() as {documents?:DocumentRow[];error?:string};if(!r.ok)throw Error(data.error??'Не удалось загрузить документы.');setDocs(data.documents??[]);const pending=(data.documents??[]).find(doc=>doc.status!=='confirmed');if(pending&&!state.identityProfile)setDocumentId(pending.id)}).catch(e=>toast.error((e as Error).message))},[user,state.identityProfile]);
  const current=state.identityProfile;
  async function upload(){
    if(!file||!consent||busy)return;setBusy(true);
    try{
      let extracted:Partial<IdentityForm>={};
      try{const text=await readImage(file);if(text)extracted=parseMrz(text)}catch{toast.message("Автораспознавание не сработало — поля можно заполнить вручную.")}
      const body=new FormData();body.append('file',file);const response=await fetch('/api/passport',{method:'POST',body});const data=await response.json() as {document?:DocumentRow;error?:string};if(!response.ok||!data.document)throw Error(data.error??'Не удалось загрузить документ.');
      setDocs(list=>[data.document!,...list]);setDocumentId(data.document.id);setForm({...empty,...extracted});toast.success(Object.keys(extracted).length?"Скан загружен, найденные данные заполнены":"Скан загружен — проверьте и заполните данные");
    }catch(error){toast.error((error as Error).message)}finally{setBusy(false)}
  }
  async function confirm(){if(!documentId)return;setBusy(true);const ok=await act({type:'identity-confirm',documentId,...form});setBusy(false);if(ok)toast.success("Паспортные данные подтверждены")}
  async function remove(id:string){if(!window.confirm('Удалить скан паспорта из защищённого хранилища?'))return;setBusy(true);try{const response=await fetch('/api/passport?id='+encodeURIComponent(id),{method:'DELETE'});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error??'Не удалось удалить документ.');if(state.identityProfile?.documentId===id)await act({type:'identity-clear',documentId:id});setDocs(list=>list.filter(doc=>doc.id!==id));if(documentId===id)setDocumentId('');toast.success('Скан удалён')}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
  if(!ready)return <Empty title="Войдите, чтобы подтвердить личность" description="Скан и подтверждённые данные доступны только владельцу профиля." href="/account" label="Открыть вход"/>;
  return <><PageHeading overline="ЗАЩИЩЁННЫЕ ДОКУМЕНТЫ" title="Паспорт для декларации." description="Загрузите разворот с фото. Atlas попробует прочитать машиночитаемую зону, а вы обязательно проверите результат."/>
    <div className={"identity-grid "+(documentId||current?"identity-has-document":"")}><section className="surface identity-upload"><div className="identity-icon"><ScanLine/></div><h2>{documentId||current?"Заменить документ":"Загрузите паспорт"}</h2><details className="ux-disclosure"><summary>Как сфотографировать паспорт</summary><p>JPG, PNG или PDF до 8 МБ. Чёткое фото без бликов, весь разворот и две строки внизу документа.</p></details><label className="file-drop"><Upload/><span>{file?file.name:"Выбрать файл или фото"}</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setFile(event.target.files?.[0]??null)}/></label><div className="consent"><Checkbox id="passport-consent" checked={consent} onCheckedChange={value=>setConsent(value===true)}/><label htmlFor="passport-consent">Согласен на <Link href="/legal#passport-consent" target="_blank" rel="noopener noreferrer">обработку паспортных данных</Link>.</label></div><button className="btn primary full" disabled={!file||!consent||busy} onClick={()=>void upload()}>{busy?<LoaderCircle className="spin"/>:<ScanLine/>}Распознать и загрузить</button><p className="micro">Изображение доступно только вашему аккаунту. Его можно удалить ниже.</p></section>
    <section className="surface identity-confirm"><h2>Проверьте данные</h2>{!documentId&&!current?<div className="identity-placeholder"><FileText/><p>После загрузки здесь появятся распознанные поля.</p></div>:<><div className="two-fields"><div className="field"><label htmlFor="last-name">Фамилия</label><input id="last-name" required value={form.lastName||(current?.lastName??"")} onChange={e=>setForm({...form,lastName:e.target.value})}/></div><div className="field"><label htmlFor="first-name">Имя</label><input id="first-name" required value={form.firstName||(current?.firstName??"")} onChange={e=>setForm({...form,firstName:e.target.value})}/></div><div className="field"><label htmlFor="birth-date">Дата рождения</label><input id="birth-date" type="date" required value={form.birthDate||(current?.birthDate??"")} onChange={e=>setForm({...form,birthDate:e.target.value})}/></div><div className="field"><label htmlFor="nationality">Гражданство / код</label><input id="nationality" value={form.nationality||(current?.nationality??"")} onChange={e=>setForm({...form,nationality:e.target.value})}/></div></div><div className="field"><label htmlFor="passport-number">Номер паспорта</label><input id="passport-number" required minLength={6} maxLength={24} value={form.passportNumber} placeholder={current?.passportMasked??"AA 1234567"} onChange={e=>setForm({...form,passportNumber:e.target.value})}/></div>{current&&<div className="notice"><Check/><span>Подтверждено {new Date(current.confirmedAt).toLocaleDateString('ru-RU')}: {current.lastName} {current.firstName}, {current.birthDate}, {current.passportMasked}</span></div>}<button className="btn primary full" disabled={!documentId||busy||!form.firstName||!form.lastName||!form.birthDate||!form.passportNumber} onClick={()=>void confirm()}><ShieldCheck/>Подтверждаю, данные верны</button></>}</section></div>
    <section className="surface document-list"><h2>Загруженные документы</h2>{docs.length?docs.map(doc=><div className="document-row" key={doc.id}><FileCheck2/><div><b>{doc.filename}</b><small>{Math.ceil(doc.size/1024)} КБ · {doc.status==='confirmed'?'данные подтверждены':'ожидает подтверждения'}</small></div><button className="icon-btn" aria-label="Удалить скан" disabled={busy} onClick={()=>void remove(doc.id)}><Trash2/></button></div>):<p>Сканов пока нет.</p>}<div className="notice warning"><AlertTriangle/><span>Atlas не выполняет государственную проверку документа и не отправляет его в таможню автоматически.</span></div></section></>;
}

export function DeclarationView(){
  const {state,ready,act}=useMarket();const eligible=state.orders.filter(order=>!order.cancelled);const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const total=eligible.filter(order=>selected.includes(order.id)).reduce((sum,order)=>sum+order.quote.merchandise,0);
  async function submit(){setBusy(true);const ok=await act({type:'declaration-preview',orderIds:selected});setBusy(false);if(ok)toast.success('Пакет декларации подготовлен')}
  if(!ready)return <Empty title="Войдите, чтобы открыть декларации" description="Документы привязаны к вашему профилю Atlas." href="/account" label="Открыть вход"/>;
  if(!state.identityProfile||!state.deliveryProfile)return <><PageHeading overline="ДОКУМЕНТЫ" title="Декларация" description="Подготовим черновик из ваших заказов."/><Empty title={!state.identityProfile?"Подтвердите паспорт":"Добавьте получателя"} description={!state.identityProfile?"Проверьте данные документа, чтобы продолжить.":"Сохраните адрес доставки в профиле."} href={!state.identityProfile?"/identity":"/account"} label={!state.identityProfile?"Проверить паспорт":"Добавить адрес"}/></>;
  return <><PageHeading overline="ТАМОЖЕННЫЙ ПАКЕТ" title="Декларация без повторного ввода." description="Atlas подставляет только подтверждённые паспортные данные, адрес и сведения из выбранных заказов."/>
    {(!state.identityProfile||!state.deliveryProfile)&&<div className="notice warning"><AlertTriangle/><span>{!state.identityProfile?<><Link className="text-link" href="/identity">Подтвердите паспорт</Link>, затем вернитесь сюда.</>:<>Сначала сохраните адрес при оформлении заказа.</>}</span></div>}
    <div className="declaration-grid"><section className="surface"><h2>Данные получателя</h2>{state.identityProfile?<dl className="declaration-facts"><div><dt>Получатель</dt><dd>{state.identityProfile.lastName} {state.identityProfile.firstName}</dd></div><div><dt>Дата рождения</dt><dd>{state.identityProfile.birthDate}</dd></div><div><dt>Паспорт</dt><dd>{state.identityProfile.passportMasked}</dd></div></dl>:<p>Паспортные данные не подтверждены.</p>}{state.deliveryProfile&&<div className="saved-address"><b>Адрес</b><span>{state.deliveryProfile.region}, {state.deliveryProfile.city}</span><small>{state.deliveryProfile.address}</small></div>}</section>
    <section className="surface"><h2>Товары в пакете</h2>{eligible.length?<><button className="text-link text-button" type="button" onClick={()=>setSelected(eligible.map(order=>order.id))}>Выбрать все заказы</button>{eligible.map(order=><label className="declaration-order" key={order.id}><Checkbox checked={selected.includes(order.id)} onCheckedChange={value=>setSelected(list=>value===true?[...new Set([...list,order.id])]:list.filter(id=>id!==order.id))}/><div><b>{order.product.declarationDescription??order.product.name}</b><small>{order.id} · {order.product.country??'Страна не указана'} · {order.quantity} шт.</small></div><strong>{money(order.quote.merchandise)}</strong></label>)}</>:<p>Сначала оформите хотя бы один заказ.</p>}<div className="summary-total"><span>Стоимость товаров<strong>{money(total)}</strong></span><span className="currency-mark">UZS</span></div><button className="btn primary full" disabled={busy||!state.identityProfile||!state.deliveryProfile||!selected.length} onClick={()=>void submit()}>{busy?<LoaderCircle className="spin"/>:<FileCheck2/>}Создать черновик</button><p className="micro center">Пакет сохраняется только в Atlas. Передача государственным органам не выполняется.</p></section></div>
    <section className="surface document-list"><h2>История пакетов</h2>{state.declarations.length?state.declarations.map(item=><div className="document-row" key={item.id}><FileCheck2/><div><b>{item.id}</b><small>{new Date(item.createdAt).toLocaleString('ru-RU')} · {item.lines.length} поз. · черновик</small></div><strong>{money(item.totalValue)}</strong></div>):<p>Черновиков пока нет.</p>}</section></>;
}
