'use client';

import {useMemo,useState,type FormEvent} from 'react';
import {BadgeCheck,CalendarDays} from 'lucide-react';
import {Amount,ConfirmDialog,money,post,type AccountingContext} from './accounting-shared';
import {normalizeTaxCalendar,taxCalendar,taxStatusNames,taxStatusTone,todayTashkent,type TaxQuarter} from './accounting-helpers';

/** Налоги: the quarter calendar (accrued vs marked paid), "mark paid" = a tax_paid ledger entry, and the rate setting. */
export function AccountingTaxes({ctx}:{ctx:AccountingContext}){
 const {books,yearBooks,canWrite,busy,run}=ctx;
 // The engine's calendar (GET ?year= → taxCalendar, with deadlines as a guide) wins; the client's own quarters are the fallback.
 const quarters=useMemo(()=>yearBooks?normalizeTaxCalendar(yearBooks.taxCalendar,yearBooks.summary)??taxCalendar(yearBooks.summary):[],[yearBooks]);
 const fromServer=!!yearBooks&&normalizeTaxCalendar(yearBooks.taxCalendar)!==null;
 const [paying,setPaying]=useState<TaxQuarter|null>(null),[amount,setAmount]=useState(''),[date,setDate]=useState(todayTashkent),[note,setNote]=useState(''),[payError,setPayError]=useState('');
 const [rate,setRate]=useState(''),[rateError,setRateError]=useState('');
 const startPay=(quarter:TaxQuarter)=>{setPaying(quarter);setAmount(quarter.due>0?String(quarter.due):quarter.accrued>0?String(quarter.accrued):'');setDate(todayTashkent());setNote(`Налог на прибыль, ${quarter.label}`);setPayError('')};
 async function markPaid(){
  const value=Math.round(Number(amount));
  if(!Number.isInteger(value)||value<=0){setPayError('Сумма — целое число больше нуля.');return}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){setPayError('Укажите дату платежа.');return}
  setPayError('');
  const ok=await run(async()=>{try{await post({kind:'entry',value:{kind:'tax_paid',amountUzs:value,occurredOn:date,counterparty:'Налоговый орган',note:note.trim().slice(0,500)||undefined}})}catch(failure){setPayError((failure as Error).message);throw failure}},'Уплата налога отмечена в журнале.');
  if(ok)setPaying(null);
 }
 async function saveRate(event:FormEvent){
  event.preventDefault();
  const value=Number(rate.replace(',','.'))/100;
  if(!Number.isFinite(value)||value<0||value>0.5){setRateError('Ставка от 0 до 50 %.');return}
  setRateError('');
  const ok=await run(()=>post({kind:'settings',value:{profitTaxRate:value}}).then(()=>undefined),'Ставка сохранена. Сверьте её с бухгалтером.');
  if(ok)setRate('');
 }
 const total=quarters.reduce((sum,quarter)=>({accrued:sum.accrued+quarter.accrued,paid:sum.paid+quarter.paid}),{accrued:0,paid:0});
 const year=yearBooks?.year??Number(books.month.slice(0,4));
 return <div className="acc-tab-body">
  <p className="micro">Налог на прибыль в Узбекистане отчитывается поквартально. Здесь — ориентир по ставке из настроек: начислено = прибыль месяцев квартала × ставка (без взаимозачёта убыточных месяцев), уплачено = записи «Уплаченный налог на прибыль» в журнале. Это не расчёт декларации: сроки, базу и ставку сверьте с бухгалтером. НДС, соцналоги и другие платежи здесь не считаются.</p>
  <div className="accounting-cards acc-cards-3">
   <article><span>Начислено за {year}, ориентир</span><strong><Amount value={total.accrued}/></strong><small>ставка {Math.round(books.settings.profitTaxRate*1000)/10} %</small></article>
   <article><span>Отмечено уплаченным</span><strong><Amount value={total.paid}/></strong><small>по записям журнала за {year}</small></article>
   <article className={total.accrued-total.paid>0?'loss':undefined}><span>Разница</span><strong><Amount value={total.accrued-total.paid}/></strong><small>{total.accrued-total.paid>0?'к уплате по ориентиру':total.accrued-total.paid<0?'уплачено больше ориентира':'расхождений нет'}</small></article>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Кварталы {year}</h4><span className="micro">{fromServer?'календарь движка: сроки — ориентир (20-е число после квартала, за IV квартал — 1 марта)':'по данным вкладки «Год»'}</span></div>
   {quarters.length?<div className="acc-quarters">{quarters.map(quarter=><article key={quarter.index} className={`acc-quarter acc-quarter-${quarter.status}`}>
    <header><CalendarDays size={16} aria-hidden="true"/><b>{quarter.label}</b><span className={`acc-badge acc-badge-${taxStatusTone(quarter.status)}`}>{taxStatusNames[quarter.status]}</span></header>
    <dl className="acc-details acc-details-inline">
     <div><dt>Период</dt><dd>{quarter.months[0]} — {quarter.periodEnd}</dd></div>
     {quarter.deadline&&<div><dt>Срок (ориентир)</dt><dd>{quarter.deadline}</dd></div>}
     {quarter.profit!==undefined&&<div><dt>Прибыль до налога</dt><dd><Amount value={quarter.profit}/></dd></div>}
     <div><dt>Начислено за квартал</dt><dd><Amount value={quarter.accrued}/></dd></div>
     {quarter.accruedToDate!==undefined&&<div><dt>Начислено с начала года</dt><dd><Amount value={quarter.accruedToDate}/></dd></div>}
     <div><dt>{quarter.paidToDate!==undefined?'Отмечено уплаченным к сроку':'Отмечено уплаченным'}</dt><dd><Amount value={quarter.paidToDate??quarter.paid}/></dd></div>
     <div><dt>К уплате</dt><dd><b><Amount value={quarter.due}/></b></dd></div>
    </dl>
    {canWrite&&<button type="button" className="btn secondary acc-compact" disabled={busy} onClick={()=>startPay(quarter)}><BadgeCheck size={16} aria-hidden="true"/>Отметить уплату</button>}
   </article>)}</div>:<p className="micro" role="status">Годовые данные загружаются…</p>}
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Ставка налога на прибыль</h4></div>
   <form className="accounting-rate" onSubmit={saveRate}>
    <label className="field"><span>Ставка, %</span><input inputMode="decimal" placeholder={String(Math.round(books.settings.profitTaxRate*1000)/10)} value={rate} disabled={!canWrite} aria-invalid={!!rateError} onChange={event=>setRate(event.target.value.replace(/[^\d.,]/g,''))}/></label>
    {canWrite&&<button type="submit" className="btn secondary" disabled={!rate||busy}>Сохранить ставку</button>}
   </form>
   {rateError&&<p className="notice error" role="alert">{rateError}</p>}
   <p className="micro">По умолчанию 15 % — ориентир. Ставка применяется ко всем открытым месяцам при расчёте; подтвердите её у бухгалтера.</p>
  </div>

  <ConfirmDialog open={!!paying} title={paying?`Отметить уплату: ${paying.label}`:'Отметить уплату'} description="В журнал добавится запись «Уплаченный налог на прибыль». Это отметка в Atlas, а не платёж: деньги переводятся в банке." confirmLabel="Отметить уплату" busy={busy} onClose={()=>setPaying(null)} onConfirm={()=>markPaid()}>
   <div className="accounting-grid">
    <label className="field"><span>Сумма, сум</span><input inputMode="numeric" value={amount} aria-invalid={!!payError} onChange={event=>setAmount(event.target.value.replace(/\D/g,''))}/>{paying&&<small className="acc-hint">Начислено за квартал {money(paying.accrued)}, отмечено уплаченным {money(paying.paidToDate??paying.paid)}, к уплате {money(paying.due)}.</small>}</label>
    <label className="field"><span>Дата платежа</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
    <label className="field accounting-note"><span>Комментарий</span><input maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label>
   </div>
   {payError&&<p className="notice error" role="alert">{payError}</p>}
  </ConfirmDialog>
 </div>;
}
