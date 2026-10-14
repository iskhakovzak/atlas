// Shared types and helpers for the admin tabs (app/admin-*.tsx). The server shapes live in lib/market/admin-server.ts.
import type {State,Pricing} from "@/lib/market/domain";
import type {Policy} from "@/lib/market/policy";
import type {AuditEvent,StaffMember,StaffRole,StaffStatus} from "@/lib/market/server";
import type {AdminDashboard,CustomerNote,SystemStatus} from "@/lib/market/admin-server";
import type {AdminSettings} from "@/lib/market/admin-dashboard";
import type {RouteVitals} from "@/lib/market/telemetry";
import {formatSum} from "@/lib/market/format";
import type {Locale} from "@/lib/market/i18n";
import {pickLocale} from "@/lib/market/uz-cyrl";

export type AdminAccount={id:string;name:string;state:State;revision:number;updatedAt:number};
export type CustomerStatus="active"|"review"|"blocked";
export type AdminData={
 accounts:AdminAccount[];pricing:Pricing;policy:Policy;staff:StaffMember[];staffSignIns?:Record<string,number>;audit:AuditEvent[];
 health:{customers:number;orders:number;feeLines:number;events:number;checkedAt:number};customerStatuses:Record<string,CustomerStatus>;
 errors:Array<{id:string;area:string;message:string;createdAt:number;resolvedAt?:number;count?:number;lastSeen?:number;route?:string}>;
 vitals?:{since:number;routes:RouteVitals[]}|null;setupWarnings?:string[];dashboard?:AdminDashboard|null;adminSettings?:AdminSettings|null;
};
export type {AdminDashboard,AdminSettings,AuditEvent,CustomerNote,StaffMember,StaffRole,StaffStatus,SystemStatus};
// Role and status names in the screen language; the plain records stay Russian for the tabs that are Russian anyway.
const roleCopy:{ru:Record<StaffRole,string>;uz:Record<StaffRole,string>;en:Record<StaffRole,string>}={
 ru:{support:"Поддержка",procurement:"Закупки",warehouse:"Склад",finance:"Финансы",admin:"Администратор"},
 uz:{support:"Yordam",procurement:"Xaridlar",warehouse:"Ombor",finance:"Moliya",admin:"Administrator"},
 en:{support:"Support",procurement:"Procurement",warehouse:"Warehouse",finance:"Finance",admin:"Administrator"},
};
const staffStatusCopy:{ru:Record<StaffStatus,string>;uz:Record<StaffStatus,string>;en:Record<StaffStatus,string>}={
 ru:{invited:"Приглашён",active:"Активен",disabled:"Отключён"},
 uz:{invited:"Taklif qilingan",active:"Faol",disabled:"O‘chirilgan"},
 en:{invited:"Invited",active:"Active",disabled:"Disabled"},
};
const customerStatusCopy:{ru:Record<CustomerStatus,string>;uz:Record<CustomerStatus,string>;en:Record<CustomerStatus,string>}={
 ru:{active:"Активен",review:"На проверке",blocked:"Заблокирован"},
 uz:{active:"Faol",review:"Tekshiruvda",blocked:"Bloklangan"},
 en:{active:"Active",review:"Under review",blocked:"Blocked"},
};
export const roleLabels:Record<StaffRole,string>=roleCopy.ru;
export const staffStatusLabels:Record<StaffStatus,string>=staffStatusCopy.ru;
export const customerStatusLabels:Record<CustomerStatus,string>=customerStatusCopy.ru;
export const roleLabelsFor=(locale:string)=>pickLocale(roleCopy,locale);
export const staffStatusLabelsFor=(locale:string)=>pickLocale(staffStatusCopy,locale);
export const customerStatusLabelsFor=(locale:string)=>pickLocale(customerStatusCopy,locale);
/** Soum sums: "1 234 сум" / "1 234 so‘m" / "1 234 UZS" in the screen language (Russian where the tab text is Russian). */
export const money=(amount:number,locale:Locale='ru')=>formatSum(Math.round(amount),locale);
// Numeric dates read the same in Russian and Uzbek (14.10.2026); English takes its own order.
const numericLocale=(locale:string)=>locale==='en'?'en-GB':'ru-RU';
export const dateTime=(at:number,locale:string='ru')=>new Date(at).toLocaleString(numericLocale(locale),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const dateOnly=(at:number,locale:string='ru')=>new Date(at).toLocaleDateString(numericLocale(locale));
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
