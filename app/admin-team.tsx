"use client";
// Admin → Команда: the staff form, the invitation text, filters, last sign-in, deactivation with a reason and the rights table.
import {useMemo,useState} from "react";
import {Copy,ShieldCheck,TriangleAlert,UserX} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {permissions,rolePermissions,staffRoles,type Permission,type StaffRole,type StaffStatus} from "@/lib/market/access";
import {filterStaff,inviteText} from "@/lib/market/admin-dashboard";
import {Modal} from "./modal";
import {useMarket} from "@/lib/market/store";
import {agoLocalized} from "@/lib/market/relative-time";
import {pickLocale} from "@/lib/market/uz-cyrl";
import {dateTime,postOperations,roleLabelsFor,staffStatusLabelsFor,type AdminData,type AuditEvent,type StaffMember} from "./admin-shared";

// The Team tab in the screen language. The invitation text itself (inviteText) stays as the server writes it.
const teamCopy={
 ru:{
  permissions:{'operations.read':'Очередь заказов и клиенты (просмотр)','operations.act':'Действия с заказами','catalog.manage':'Каталог и подборки','pricing.manage':'Тарифы и курс','policy.manage':'Правила и лимиты','staff.manage':'Команда и роли','customers.manage':'Статус клиента','support.reply':'Ответы клиентам','finance.read':'Бухгалтерия (просмотр)','finance.write':'Записи журнала','system.manage':'Система и резервная копия','audit.read':'Журнал действий','content.manage':'Контент сайта'} as Record<Permission,string>,
  title:'Команда и роли',active:(n:number)=>n+' активных',name:'Имя сотрудника',role:'Роль',status:'Статус',statusOptions:{invited:'Приглашён — без доступа',active:'Активен — доступ включён',disabled:'Отключён — без доступа'} as Record<StaffStatus,string>,saving:'Сохраняем…',save:'Сохранить сотрудника',
  inviteTitle:'Приглашение.',inviteText:'Отдельной ссылки-приглашения нет: доступ открывается входом по коду на email. Отправьте сотруднику этот текст:',copy:'Скопировать',
  search:'Поиск',searchPlaceholder:'Имя или email',allRoles:'Все роли',allStatuses:'Все статусы',shown:(n:number,all:number)=>n+' из '+all,
  member:'Сотрудник',lastSignIn:'Последний вход',updated:'Обновлён',actions:'Действия',self:' · это вы',never:'не входил',disable:'Отключить',nobody:'Никого не найдено.',
  right:'Право',yes:'есть',no:'нет',rightsNote:'Поддержка переводит клиента на проверку и обратно; блокирует только администратор. Права меняются в коде (lib/market/access.ts), не здесь.',
  disableTitle:'Отключить доступ',reason:'Причина (попадёт в журнал)',disableNote:'Доступ пропадёт при следующем запросе сотрудника. Карточка остаётся в справочнике со статусом «Отключён». Себя и основного администратора отключить нельзя.',disabling:'Отключаем…',
  saved:'Карточка сотрудника сохранена.',disabled:'Доступ отключён, причина записана в журнал.',copied:'Инструкция скопирована.',copyFailed:'Не удалось скопировать — выделите текст вручную.',
 },
 uz:{
  permissions:{'operations.read':'Buyurtmalar navbati va mijozlar (ko‘rish)','operations.act':'Buyurtmalar bilan amallar','catalog.manage':'Katalog va to‘plamlar','pricing.manage':'Tariflar va kurs','policy.manage':'Qoidalar va limitlar','staff.manage':'Jamoa va rollar','customers.manage':'Mijoz holati','support.reply':'Mijozlarga javoblar','finance.read':'Buxgalteriya (ko‘rish)','finance.write':'Jurnal yozuvlari','system.manage':'Tizim va zaxira nusxasi','audit.read':'Amallar jurnali','content.manage':'Sayt kontenti'} as Record<Permission,string>,
  title:'Jamoa va rollar',active:(n:number)=>n+' ta faol',name:'Xodim ismi',role:'Rol',status:'Holat',statusOptions:{invited:'Taklif qilingan — ruxsatsiz',active:'Faol — ruxsat yoqilgan',disabled:'O‘chirilgan — ruxsatsiz'} as Record<StaffStatus,string>,saving:'Saqlanmoqda…',save:'Xodimni saqlash',
  inviteTitle:'Taklif.',inviteText:'Alohida taklif havolasi yo‘q: ruxsat email kodi bilan kirganda ochiladi. Xodimga ushbu matnni yuboring:',copy:'Nusxa olish',
  search:'Qidiruv',searchPlaceholder:'Ism yoki email',allRoles:'Barcha rollar',allStatuses:'Barcha holatlar',shown:(n:number,all:number)=>all+' tadan '+n+' ta',
  member:'Xodim',lastSignIn:'Oxirgi kirish',updated:'Yangilangan',actions:'Amallar',self:' · siz',never:'kirmagan',disable:'O‘chirish',nobody:'Hech kim topilmadi.',
  right:'Huquq',yes:'bor',no:'yo‘q',rightsNote:'Yordam xizmati mijozni tekshiruvga yuboradi va qaytaradi; faqat administrator bloklaydi. Huquqlar bu yerda emas, kodda (lib/market/access.ts) o‘zgaradi.',
  disableTitle:'Ruxsatni o‘chirish',reason:'Sabab (jurnalga yoziladi)',disableNote:'Ruxsat xodimning keyingi so‘rovida yo‘qoladi. Karta ro‘yxatda «O‘chirilgan» holatida qoladi. O‘zingizni va asosiy administratorni o‘chirib bo‘lmaydi.',disabling:'O‘chirilmoqda…',
  saved:'Xodim kartasi saqlandi.',disabled:'Ruxsat o‘chirildi, sabab jurnalga yozildi.',copied:'Ko‘rsatma nusxalandi.',copyFailed:'Nusxalab bo‘lmadi — matnni qo‘lda belgilang.',
 },
 en:{
  permissions:{'operations.read':'Order queue and customers (view)','operations.act':'Order actions','catalog.manage':'Catalog and collections','pricing.manage':'Tariffs and rate','policy.manage':'Rules and limits','staff.manage':'Team and roles','customers.manage':'Customer status','support.reply':'Replies to customers','finance.read':'Accounting (view)','finance.write':'Ledger entries','system.manage':'System and backup','audit.read':'Audit log','content.manage':'Site content'} as Record<Permission,string>,
  title:'Team and roles',active:(n:number)=>n+' active',name:'Staff member name',role:'Role',status:'Status',statusOptions:{invited:'Invited — no access',active:'Active — access on',disabled:'Disabled — no access'} as Record<StaffStatus,string>,saving:'Saving…',save:'Save staff member',
  inviteTitle:'Invitation.',inviteText:'There is no separate invite link: access opens when they sign in with an email code. Send the staff member this text:',copy:'Copy',
  search:'Search',searchPlaceholder:'Name or email',allRoles:'All roles',allStatuses:'All statuses',shown:(n:number,all:number)=>n+' of '+all,
  member:'Staff member',lastSignIn:'Last sign-in',updated:'Updated',actions:'Actions',self:' · you',never:'never signed in',disable:'Disable',nobody:'No one found.',
  right:'Permission',yes:'yes',no:'no',rightsNote:'Support moves a customer to review and back; only the administrator blocks. Rights change in code (lib/market/access.ts), not here.',
  disableTitle:'Disable access',reason:'Reason (goes to the audit log)',disableNote:'Access ends with the staff member’s next request. The card stays in the directory as “Disabled”. You cannot disable yourself or the primary administrator.',disabling:'Disabling…',
  saved:'Staff card saved.',disabled:'Access disabled; the reason is logged.',copied:'Instructions copied.',copyFailed:'Could not copy — select the text manually.',
 },
};
type Form={email:string;displayName:string;role:StaffRole;status:StaffStatus};
const emptyForm:Form={email:"",displayName:"",role:"support",status:"invited"};

export function AdminTeam({data,userEmail,copy,onChanged}:{data:AdminData;userEmail:string;copy:{staffIntro:string;rolesTitle:string;statusHint:string;signInWarning:string;primaryNote:string};onChanged:(next:{staff?:StaffMember[];audit?:AuditEvent[]})=>void}){
 const {state}=useMarket(),lang=state.communication.language,t=pickLocale(teamCopy,lang),roleLabels=roleLabelsFor(lang),staffStatusLabels=staffStatusLabelsFor(lang),now=new Date().getTime();
 const [form,setForm]=useState<Form>(emptyForm),[busy,setBusy]=useState(false),[role,setRole]=useState('all'),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[deactivate,setDeactivate]=useState<StaffMember|null>(null),[reason,setReason]=useState('');
 const rows=useMemo(()=>filterStaff(data.staff,{role,status,q:query}),[data.staff,role,status,query]);
 const invite=form.email.includes('@')?inviteText(form.email,typeof window==='undefined'?'atlas':window.location.origin):'';
 async function save(){setBusy(true);try{const next=await postOperations<{staff:StaffMember[];audit:AuditEvent[]}>({kind:'staff',value:form});onChanged(next);setForm(emptyForm);toast.success(t.saved)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 async function confirmDeactivate(){if(!deactivate||reason.trim().length<2)return;setBusy(true);try{const next=await postOperations<{staff:StaffMember[];audit:AuditEvent[]}>({kind:'staff-deactivate',email:deactivate.email,reason:reason.trim()});onChanged(next);setDeactivate(null);setReason('');toast.success(t.disabled)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 async function copyInvite(){try{await navigator.clipboard.writeText(invite);toast.success(t.copied)}catch{toast.error(t.copyFailed)}}
 return <section className="surface admin-section admin-team">
  <div className="admin-section-head"><div><h2>{t.title}</h2><p>{copy.staffIntro}</p></div><span className="admin-count">{t.active(data.staff.filter(member=>member.status==='active').length)}</span></div>
  <div className="notice admin-access-warning"><TriangleAlert/><span>{copy.signInWarning}</span></div>
  <div className="staff-form"><div className="field"><label htmlFor="staff-name">{t.name}</label><input id="staff-name" value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})}/></div><div className="field"><label htmlFor="staff-email">Email</label><input id="staff-email" type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></div><div className="field"><label htmlFor="staff-role">{t.role}</label><select id="staff-role" value={form.role} onChange={event=>setForm({...form,role:event.target.value as StaffRole})}>{staffRoles.map(value=><option key={value} value={value}>{roleLabels[value]}</option>)}</select></div><div className="field"><label htmlFor="staff-status">{t.status}</label><select id="staff-status" value={form.status} onChange={event=>setForm({...form,status:event.target.value as StaffStatus})}>{(['invited','active','disabled'] as const).map(value=><option key={value} value={value}>{t.statusOptions[value]}</option>)}</select></div><button type="button" className="btn primary" disabled={busy||!form.email||form.displayName.trim().length<2} onClick={()=>void save()}>{busy?t.saving:t.save}</button></div>
  {invite&&<div className="admin-invite-box"><p><b>{t.inviteTitle}</b> {t.inviteText}</p><p className="admin-invite">{invite}</p><button type="button" className="btn secondary" onClick={()=>void copyInvite()}><Copy size={16}/>{t.copy}</button></div>}
  <p className="micro">{copy.statusHint} {copy.primaryNote}</p>
  <div className="admin-filters">
   <label className="field"><span>{t.search}</span><input type="search" placeholder={t.searchPlaceholder} value={query} onChange={event=>setQuery(event.target.value)}/></label>
   <label className="field"><span>{t.role}</span><select value={role} onChange={event=>setRole(event.target.value)}><option value="all">{t.allRoles}</option>{staffRoles.map(value=><option key={value} value={value}>{roleLabels[value]}</option>)}</select></label>
   <label className="field"><span>{t.status}</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">{t.allStatuses}</option>{(['active','invited','disabled'] as const).map(value=><option key={value} value={value}>{staffStatusLabels[value]}</option>)}</select></label>
   <p className="micro admin-filter-count">{t.shown(rows.length,data.staff.length)}</p>
  </div>
  <div className="admin-scroll"><table className="admin-grid"><thead><tr><th>{t.member}</th><th>{t.role}</th><th>{t.status}</th><th>{t.lastSignIn}</th><th className="num">{t.updated}</th><th className="num"><span className="sr-only">{t.actions}</span></th></tr></thead><tbody>
   {rows.map(member=>{const last=data.staffSignIns?.[member.email];const self=member.email===userEmail.toLowerCase();return <tr key={member.id}>
    <td><button type="button" className="admin-link" onClick={()=>setForm({email:member.email,displayName:member.displayName,role:member.role,status:member.status})}><b>{member.displayName}</b><small>{member.email}{self?t.self:''}</small></button></td>
    <td>{roleLabels[member.role]}</td>
    <td><i className={`staff-status ${member.status}`}>{staffStatusLabels[member.status]}</i></td>
    <td>{last?<span title={dateTime(last,lang)}>{agoLocalized(last,lang,now)}</span>:<span className="micro">{t.never}</span>}</td>
    <td className="num">{dateTime(member.updatedAt,lang)}</td>
    <td className="num admin-cell-control">{member.status!=='disabled'&&!self&&<button type="button" className="btn secondary admin-btn-small" disabled={busy} onClick={()=>{setDeactivate(member);setReason('')}}><UserX size={15}/>{t.disable}</button>}</td>
   </tr>})}
   {!rows.length&&<tr><td colSpan={6} className="micro">{t.nobody}</td></tr>}
  </tbody></table></div>
  <h3 className="admin-subhead"><ShieldCheck size={17} aria-hidden="true"/> {copy.rolesTitle}</h3>
  <div className="admin-scroll"><table className="admin-grid admin-rights"><thead><tr><th>{t.right}</th>{staffRoles.map(value=><th key={value} className="center">{roleLabels[value]}</th>)}</tr></thead><tbody>
   {permissions.map(permission=><tr key={permission}><td><b>{t.permissions[permission]}</b><small>{permission}</small></td>{staffRoles.map(value=><td key={value} className="center">{rolePermissions[value].includes(permission)?<span aria-label={t.yes}>✓</span>:<span className="micro" aria-label={t.no}>—</span>}</td>)}</tr>)}
  </tbody></table></div>
  <p className="micro">{t.rightsNote}</p>
  <Modal open={!!deactivate} onClose={()=>setDeactivate(null)} title={t.disableTitle} description={deactivate?`${deactivate.displayName} · ${deactivate.email}`:''} locale={lang}>
   <form className="admin-note-form" onSubmit={event=>{event.preventDefault();void confirmDeactivate()}}><label className="field" htmlFor="deactivate-reason"><span>{t.reason}</span><textarea id="deactivate-reason" rows={3} maxLength={500} required value={reason} onChange={event=>setReason(event.target.value)}/></label><p className="micro">{t.disableNote}</p><button type="submit" className="btn primary" disabled={busy||reason.trim().length<2}>{busy?t.disabling:t.disableTitle}</button></form>
  </Modal>
 </section>;
}
