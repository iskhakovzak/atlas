"use client";
// Admin → Правила: the limits form with field validation and the policy history from the audit log.
import {useMemo,useState} from "react";
import {History,Settings2} from "lucide-react";
import {toast} from "sonner";
import type {Policy} from "@/lib/market/policy";
import {policyErrors,policyHistory,type PolicyDraft} from "@/lib/market/admin-dashboard";
import {dateTime,postOperations,type AuditEvent} from "./admin-shared";

const splitList=(value:string)=>value.split(',').map(item=>item.trim()).filter(Boolean);
export function AdminRules({policy,audit,onSaved}:{policy:Policy;audit:AuditEvent[];onSaved:(next:{policy:Policy})=>Promise<void>|void}){
 const [draft,setDraft]=useState<PolicyDraft>({maxCartLines:policy.maxCartLines,maxCartWeightKg:policy.maxCartWeightKg,maxMerchandiseUsd:policy.maxMerchandiseUsd,blockedCategories:policy.blockedCategories,restrictedTerms:policy.restrictedTerms});
 const [categoriesText,setCategoriesText]=useState(policy.blockedCategories.join(', ')),[termsText,setTermsText]=useState(policy.restrictedTerms.join(', ')),[busy,setBusy]=useState(false);
 const errors=policyErrors(draft),invalid=Object.keys(errors).length>0;
 const history=useMemo(()=>policyHistory(audit),[audit]);
 const dirty=JSON.stringify(draft)!==JSON.stringify({maxCartLines:policy.maxCartLines,maxCartWeightKg:policy.maxCartWeightKg,maxMerchandiseUsd:policy.maxMerchandiseUsd,blockedCategories:policy.blockedCategories,restrictedTerms:policy.restrictedTerms});
 async function save(){if(invalid)return;setBusy(true);try{const next=await postOperations<{policy:Policy}>({kind:'policy',value:draft});await onSaved(next);toast.success('Ограничения обновлены и записаны в журнал.')}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 const number=(key:'maxCartLines'|'maxCartWeightKg'|'maxMerchandiseUsd')=>(event:React.ChangeEvent<HTMLInputElement>)=>setDraft({...draft,[key]:event.target.value===''?NaN:Number(event.target.value)});
 return <section className="surface admin-policy admin-section"><div className="admin-section-head"><div><h2><Settings2 size={20} aria-hidden="true"/> Лимиты и ручная проверка</h2><p>Правила применяются на сервере ко всем новым действиям покупателей. Текущая версия: {policy.version}{policy.updatedAt?` · ${dateTime(policy.updatedAt)}`:''}{policy.managedBy?` · ${policy.managedBy}`:''}.</p></div></div>
  <div className="pricing-grid admin-rules-grid">
   <div className={`field${errors.maxCartLines?' invalid':''}`}><label htmlFor="max-lines">Позиций в партии</label><input id="max-lines" type="number" inputMode="numeric" min="1" max="20" step="1" value={Number.isFinite(draft.maxCartLines)?draft.maxCartLines:''} aria-invalid={!!errors.maxCartLines} aria-describedby={errors.maxCartLines?'max-lines-error':undefined} onChange={number('maxCartLines')}/>{errors.maxCartLines&&<small id="max-lines-error" className="admin-field-error">{errors.maxCartLines}</small>}</div>
   <div className={`field${errors.maxCartWeightKg?' invalid':''}`}><label htmlFor="max-weight">Расчётный вес, кг</label><input id="max-weight" type="number" inputMode="decimal" min="0.1" max="200" step="0.1" value={Number.isFinite(draft.maxCartWeightKg)?draft.maxCartWeightKg:''} aria-invalid={!!errors.maxCartWeightKg} aria-describedby={errors.maxCartWeightKg?'max-weight-error':undefined} onChange={number('maxCartWeightKg')}/>{errors.maxCartWeightKg&&<small id="max-weight-error" className="admin-field-error">{errors.maxCartWeightKg}</small>}</div>
   <div className={`field${errors.maxMerchandiseUsd?' invalid':''}`}><label htmlFor="max-usd">Стоимость товаров, USD</label><input id="max-usd" type="number" inputMode="numeric" min="1" max="50000" step="1" value={Number.isFinite(draft.maxMerchandiseUsd)?draft.maxMerchandiseUsd:''} aria-invalid={!!errors.maxMerchandiseUsd} aria-describedby={errors.maxMerchandiseUsd?'max-usd-error':undefined} onChange={number('maxMerchandiseUsd')}/>{errors.maxMerchandiseUsd&&<small id="max-usd-error" className="admin-field-error">{errors.maxMerchandiseUsd}</small>}</div>
  </div>
  <div className="two-fields">
   <div className={`field${errors.blockedCategories?' invalid':''}`}><label htmlFor="blocked-categories">Запрещённые категории (через запятую)</label><input id="blocked-categories" value={categoriesText} aria-invalid={!!errors.blockedCategories} onChange={event=>{setCategoriesText(event.target.value);setDraft({...draft,blockedCategories:splitList(event.target.value)})}}/>{errors.blockedCategories&&<small className="admin-field-error">{errors.blockedCategories}</small>}</div>
   <div className={`field${errors.restrictedTerms?' invalid':''}`}><label htmlFor="restricted-terms">Слова для ручной проверки (через запятую)</label><input id="restricted-terms" value={termsText} aria-invalid={!!errors.restrictedTerms} onChange={event=>{setTermsText(event.target.value);setDraft({...draft,restrictedTerms:splitList(event.target.value)})}}/>{errors.restrictedTerms&&<small className="admin-field-error">{errors.restrictedTerms}</small>}</div>
  </div>
  <div className="admin-system-actions"><button type="button" className="btn primary" disabled={busy||invalid||!dirty} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить правила'}</button>{dirty&&!invalid&&<span className="micro">Есть несохранённые изменения.</span>}{invalid&&<span className="micro admin-field-error">Исправьте отмеченные поля.</span>}</div>
  <h3 className="admin-subhead"><History size={17} aria-hidden="true"/> История изменений</h3>
  {history.length?<ul className="admin-plain-list admin-history">{history.map(item=><li key={item.id}><b>{dateTime(item.at)}</b><span>{item.actor}{item.fields.length?' · '+item.fields.map(([key,value])=>`${key}: ${value}`).join(', '):''}</span></li>)}</ul>:<p className="micro">Изменений правил в последних записях журнала нет. Полный архив — во вкладке «Журнал» с фильтром «Тарифы и правила».</p>}
 </section>;
}
