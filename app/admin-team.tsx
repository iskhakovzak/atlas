"use client";
// Admin → Команда: the staff form, the invitation text, filters, last sign-in, deactivation with a reason and the rights table.
import {useMemo,useState} from "react";
import {Copy,ShieldCheck,TriangleAlert,UserX} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {permissions,rolePermissions,staffRoles,type Permission,type StaffRole,type StaffStatus} from "@/lib/market/access";
import {filterStaff,inviteText} from "@/lib/market/admin-dashboard";
import {Modal} from "./market-ui";
import {ago,dateTime,postOperations,roleLabels,staffStatusLabels,type AdminData,type AuditEvent,type StaffMember} from "./admin-shared";

const permissionLabels:Record<Permission,string>={
 'operations.read':'Очередь заказов и клиенты (просмотр)','operations.act':'Действия с заказами','catalog.manage':'Каталог и подборки','pricing.manage':'Тарифы и курс','policy.manage':'Правила и лимиты',
 'staff.manage':'Команда и роли','customers.manage':'Статус клиента','support.reply':'Ответы клиентам','finance.read':'Бухгалтерия (просмотр)','finance.write':'Записи журнала','system.manage':'Система и резервная копия','audit.read':'Журнал действий','content.manage':'Контент сайта',
};
type Form={email:string;displayName:string;role:StaffRole;status:StaffStatus};
const emptyForm:Form={email:"",displayName:"",role:"support",status:"invited"};

export function AdminTeam({data,userEmail,copy,onChanged}:{data:AdminData;userEmail:string;copy:{staffIntro:string;rolesTitle:string;statusHint:string;signInWarning:string;primaryNote:string};onChanged:(next:{staff?:StaffMember[];audit?:AuditEvent[]})=>void}){
 const [form,setForm]=useState<Form>(emptyForm),[busy,setBusy]=useState(false),[role,setRole]=useState('all'),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[deactivate,setDeactivate]=useState<StaffMember|null>(null),[reason,setReason]=useState('');
 const rows=useMemo(()=>filterStaff(data.staff,{role,status,q:query}),[data.staff,role,status,query]);
 const invite=form.email.includes('@')?inviteText(form.email,typeof window==='undefined'?'atlas':window.location.origin):'';
 async function save(){setBusy(true);try{const next=await postOperations<{staff:StaffMember[];audit:AuditEvent[]}>({kind:'staff',value:form});onChanged(next);setForm(emptyForm);toast.success('Карточка сотрудника сохранена.')}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 async function confirmDeactivate(){if(!deactivate||reason.trim().length<2)return;setBusy(true);try{const next=await postOperations<{staff:StaffMember[];audit:AuditEvent[]}>({kind:'staff-deactivate',email:deactivate.email,reason:reason.trim()});onChanged(next);setDeactivate(null);setReason('');toast.success('Доступ отключён, причина записана в журнал.')}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 async function copyInvite(){try{await navigator.clipboard.writeText(invite);toast.success('Инструкция скопирована.')}catch{toast.error('Не удалось скопировать — выделите текст вручную.')}}
 return <section className="surface admin-section admin-team">
  <div className="admin-section-head"><div><h2>Команда и роли</h2><p>{copy.staffIntro}</p></div><span className="admin-count">{data.staff.filter(member=>member.status==='active').length} активных</span></div>
  <div className="notice admin-access-warning"><TriangleAlert/><span>{copy.signInWarning}</span></div>
  <div className="staff-form"><div className="field"><label htmlFor="staff-name">Имя сотрудника</label><input id="staff-name" value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})}/></div><div className="field"><label htmlFor="staff-email">Email</label><input id="staff-email" type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></div><div className="field"><label htmlFor="staff-role">Роль</label><select id="staff-role" value={form.role} onChange={event=>setForm({...form,role:event.target.value as StaffRole})}>{staffRoles.map(value=><option key={value} value={value}>{roleLabels[value]}</option>)}</select></div><div className="field"><label htmlFor="staff-status">Статус</label><select id="staff-status" value={form.status} onChange={event=>setForm({...form,status:event.target.value as StaffStatus})}><option value="invited">Приглашён — без доступа</option><option value="active">Активен — доступ включён</option><option value="disabled">Отключён — без доступа</option></select></div><button type="button" className="btn primary" disabled={busy||!form.email||form.displayName.trim().length<2} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить сотрудника'}</button></div>
  {invite&&<div className="admin-invite-box"><p><b>Приглашение.</b> Отдельной ссылки-приглашения нет: доступ открывается входом по коду на email. Отправьте сотруднику этот текст:</p><p className="admin-invite">{invite}</p><button type="button" className="btn secondary" onClick={()=>void copyInvite()}><Copy size={16}/>Скопировать</button></div>}
  <p className="micro">{copy.statusHint} {copy.primaryNote}</p>
  <div className="admin-filters">
   <label className="field"><span>Поиск</span><input type="search" placeholder="Имя или email" value={query} onChange={event=>setQuery(event.target.value)}/></label>
   <label className="field"><span>Роль</span><select value={role} onChange={event=>setRole(event.target.value)}><option value="all">Все роли</option>{staffRoles.map(value=><option key={value} value={value}>{roleLabels[value]}</option>)}</select></label>
   <label className="field"><span>Статус</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Все статусы</option><option value="active">Активен</option><option value="invited">Приглашён</option><option value="disabled">Отключён</option></select></label>
   <p className="micro admin-filter-count">{rows.length} из {data.staff.length}</p>
  </div>
  <div className="admin-scroll"><table className="admin-grid"><thead><tr><th>Сотрудник</th><th>Роль</th><th>Статус</th><th>Последний вход</th><th className="num">Обновлён</th><th className="num"><span className="sr-only">Действия</span></th></tr></thead><tbody>
   {rows.map(member=>{const last=data.staffSignIns?.[member.email];const self=member.email===userEmail.toLowerCase();return <tr key={member.id}>
    <td><button type="button" className="admin-link" onClick={()=>setForm({email:member.email,displayName:member.displayName,role:member.role,status:member.status})}><b>{member.displayName}</b><small>{member.email}{self?' · это вы':''}</small></button></td>
    <td>{roleLabels[member.role]}</td>
    <td><i className={`staff-status ${member.status}`}>{staffStatusLabels[member.status]}</i></td>
    <td>{last?<span title={dateTime(last)}>{ago(last)}</span>:<span className="micro">не входил</span>}</td>
    <td className="num">{dateTime(member.updatedAt)}</td>
    <td className="num admin-cell-control">{member.status!=='disabled'&&!self&&<button type="button" className="btn secondary admin-btn-small" disabled={busy} onClick={()=>{setDeactivate(member);setReason('')}}><UserX size={15}/>Отключить</button>}</td>
   </tr>})}
   {!rows.length&&<tr><td colSpan={6} className="micro">Никого не найдено.</td></tr>}
  </tbody></table></div>
  <h3 className="admin-subhead"><ShieldCheck size={17} aria-hidden="true"/> {copy.rolesTitle}</h3>
  <div className="admin-scroll"><table className="admin-grid admin-rights"><thead><tr><th>Право</th>{staffRoles.map(value=><th key={value} className="center">{roleLabels[value]}</th>)}</tr></thead><tbody>
   {permissions.map(permission=><tr key={permission}><td><b>{permissionLabels[permission]}</b><small>{permission}</small></td>{staffRoles.map(value=><td key={value} className="center">{rolePermissions[value].includes(permission)?<span aria-label="есть">✓</span>:<span className="micro" aria-label="нет">—</span>}</td>)}</tr>)}
  </tbody></table></div>
  <p className="micro">Поддержка переводит клиента на проверку и обратно; блокирует только администратор. Права меняются в коде (lib/market/access.ts), не здесь.</p>
  <Modal open={!!deactivate} onClose={()=>setDeactivate(null)} title="Отключить доступ" description={deactivate?`${deactivate.displayName} · ${deactivate.email}`:''}>
   <form className="admin-note-form" onSubmit={event=>{event.preventDefault();void confirmDeactivate()}}><label className="field" htmlFor="deactivate-reason"><span>Причина (попадёт в журнал)</span><textarea id="deactivate-reason" rows={3} maxLength={500} required value={reason} onChange={event=>setReason(event.target.value)}/></label><p className="micro">Доступ пропадёт при следующем запросе сотрудника. Карточка остаётся в справочнике со статусом «Отключён». Себя и основного администратора отключить нельзя.</p><button type="submit" className="btn primary" disabled={busy||reason.trim().length<2}>{busy?'Отключаем…':'Отключить доступ'}</button></form>
  </Modal>
 </section>;
}
