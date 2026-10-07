// Shared types and helpers for the admin tabs (app/admin-*.tsx). The server shapes live in lib/market/admin-server.ts.
import type {State,Pricing} from "@/lib/market/domain";
import type {Policy} from "@/lib/market/policy";
import type {AuditEvent,StaffMember,StaffRole,StaffStatus} from "@/lib/market/server";
import type {AdminDashboard,CustomerNote,SystemStatus} from "@/lib/market/admin-server";
import type {AdminSettings} from "@/lib/market/admin-dashboard";
import type {RouteVitals} from "@/lib/market/telemetry";
import {formatSum} from "@/lib/market/format";

export type AdminAccount={id:string;name:string;state:State;revision:number;updatedAt:number};
export type CustomerStatus="active"|"review"|"blocked";
export type AdminData={
 accounts:AdminAccount[];pricing:Pricing;policy:Policy;staff:StaffMember[];staffSignIns?:Record<string,number>;audit:AuditEvent[];
 health:{customers:number;orders:number;feeLines:number;events:number;checkedAt:number};customerStatuses:Record<string,CustomerStatus>;
 errors:Array<{id:string;area:string;message:string;createdAt:number;resolvedAt?:number;count?:number;lastSeen?:number;route?:string}>;
 vitals?:{since:number;routes:RouteVitals[]}|null;setupWarnings?:string[];dashboard?:AdminDashboard|null;adminSettings?:AdminSettings|null;
};
export type {AdminDashboard,AdminSettings,AuditEvent,CustomerNote,StaffMember,StaffRole,StaffStatus,SystemStatus};
export const roleLabels:Record<StaffRole,string>={support:"Поддержка",procurement:"Закупки",warehouse:"Склад",finance:"Финансы",admin:"Администратор"};
export const staffStatusLabels:Record<StaffStatus,string>={invited:"Приглашён",active:"Активен",disabled:"Отключён"};
export const customerStatusLabels:Record<CustomerStatus,string>={active:"Активен",review:"На проверке",blocked:"Заблокирован"};
export const money=(amount:number)=>formatSum(Math.round(amount),'ru');
export const dateTime=(at:number)=>new Date(at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const dateOnly=(at:number)=>new Date(at).toLocaleDateString('ru-RU');
/** "5 мин назад" / "3 ч назад" / "4 дн назад" for compact tables. */
export function ago(at:number,now=Date.now()){const m=Math.max(0,Math.round((now-at)/60000));if(m<60)return `${m} мин назад`;const h=Math.round(m/60);if(h<48)return `${h} ч назад`;return `${Math.round(h/24)} дн назад`}
/** POST to /api/operations; throws the server's message on failure. */
export async function postOperations<T>(body:Record<string,unknown>):Promise<T>{
 const response=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
 const next=await response.json().catch(()=>({})) as T&{error?:string};
 if(!response.ok)throw Error(next.error??'Не удалось выполнить действие.');
 return next;
}
export async function getOperations<T>(query:string):Promise<T>{
 const response=await fetch(`/api/operations?${query}`,{cache:'no-store',credentials:'same-origin'});
 const next=await response.json().catch(()=>({})) as T&{error?:string};
 if(!response.ok)throw Error(next.error??'Не удалось загрузить данные.');
 return next;
}
/** Opens a CSV from the API as a download (the browser handles Content-Disposition). */
export function downloadCsv(query:string){window.location.assign(`/api/operations?${query}`)}
