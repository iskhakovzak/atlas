"use client";
// Admin → «Для инвестора»: the business on one page — key figures against the previous period, twelve months of
// GMV and Atlas income, the unit economics of an average order, the funnel, geography and assortment, cohorts and a
// growth model on editable assumptions. Everything is computed on the client from the anonymised snapshot that
// GET /api/operations?investor=1 returns (lib/market/investor-metrics.ts); the model stores nothing.
import {useEffect,useMemo,useState,type CSSProperties} from "react";
import {ClipboardCopy,Download,Info,Printer,RefreshCw,ShieldCheck,TrendingUp} from "lucide-react";
import {toast} from "sonner";
import {
 clampAssumptions,defaultAssumptions,growthModel,honestyNote,investorPeriods,investorReport,monthLabel,summaryText,
 type GrowthAssumptions,type InvestorKpis,type InvestorPeriod,type InvestorReport,type InvestorSnapshot,type ShareRow,
} from "@/lib/market/investor-metrics";
import {dateOnly,downloadCsv,getOperations,money} from "./admin-shared";

const pct=(value:number|null|undefined,digits=1)=>value===null||value===undefined?'—':`${(Math.round(value*1000)/10).toLocaleString('ru-RU',{maximumFractionDigits:digits})} %`;
const count=(value:number)=>Math.round(value).toLocaleString('ru-RU');
/** 1 234 567 → «1,2 млн» for chart ticks; small numbers stay as digits. */
export function compactSum(value:number){
 const abs=Math.abs(value),sign=value<0?'−':'';
 const f=(n:number,unit:string)=>`${sign}${n.toLocaleString('ru-RU',{maximumFractionDigits:n<10?1:0})} ${unit}`;
 if(abs>=1e9)return f(abs/1e9,'млрд');if(abs>=1e6)return f(abs/1e6,'млн');if(abs>=1e3)return f(abs/1e3,'тыс');return `${sign}${count(abs)}`;
}

type KpiCard={key:keyof InvestorKpis;label:string;hint:string;format:(value:number)=>string;invert?:boolean};
const kpiCards:KpiCard[]=[
 {key:'gmv',label:'GMV',hint:'сумма к оплате по неотменённым заказам',format:money},
 {key:'revenue',label:'Выручка Atlas',hint:'комиссия + доставка + курс + услуги, по отметкам «оплачено»',format:money},
 {key:'grossMargin',label:'Валовая маржа',hint:'выручка минус расходы журнала, привязанные к заказам',format:value=>pct(value)},
 {key:'orders',label:'Заказы',hint:'неотменённые, по дате оформления',format:count},
 {key:'activeCustomers',label:'Активные клиенты',hint:'с хотя бы одним заказом за период',format:count},
 {key:'repeatRate',label:'Повторные покупки',hint:'доля клиентов с двумя и более заказами',format:value=>pct(value)},
 {key:'averageCheck',label:'Средний чек',hint:'GMV / заказы',format:money},
 {key:'revenuePerOrder',label:'Выручка с заказа',hint:'выручка / оплаченные отметки',format:money},
 {key:'takeRate',label:'Take rate',hint:'доля Atlas в сумме оплаченных заказов',format:value=>pct(value)},
];

export function AdminInvestor(){
 const [snapshot,setSnapshot]=useState<InvestorSnapshot|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const [period,setPeriod]=useState<InvestorPeriod>('12m'),[paidOnly,setPaidOnly]=useState(false),[excludeTest,setExcludeTest]=useState(true);
 const fetchSnapshot=()=>getOperations<{investor:InvestorSnapshot}>('investor=1').then(next=>{setSnapshot(next.investor);setLoadError('')}).catch(error=>setLoadError((error as Error).message)).finally(()=>setLoading(false));
 const load=()=>{setLoading(true);void fetchSnapshot()};
 // The first read starts in an effect; state changes only when the response arrives.
 useEffect(()=>{void fetchSnapshot()},[]);
 const report=useMemo(()=>snapshot?investorReport(snapshot,period,{paidOnly,excludeTest}):null,[snapshot,period,paidOnly,excludeTest]);
 async function copySummary(){
  if(!report)return;
  try{await navigator.clipboard.writeText(summaryText(report));toast.success('Сводка скопирована в буфер обмена.')}catch{toast.error('Буфер обмена недоступен: скопируйте текст вручную из версии для печати.')}
 }
 return <div className="admin-investor" data-period={period}>
  <section className="surface admin-section inv-head">
   <div className="admin-section-head">
    <div><h2><TrendingUp aria-hidden="true"/>Atlas — покупки в зарубежных магазинах с доставкой в Ташкент</h2><p>Витрина бизнеса по данным Atlas{report?` на ${dateOnly(report.computedAt)}`:''}. Все суммы в сумах, период — скользящий, сравнение с таким же периодом до него.</p></div>
    <div className="inv-actions no-print">
     <button type="button" className="btn secondary" onClick={()=>window.print()} disabled={!report}><Printer size={16} aria-hidden="true"/>Версия для печати</button>
     <button type="button" className="btn secondary" onClick={()=>void copySummary()} disabled={!report}><ClipboardCopy size={16} aria-hidden="true"/>Скопировать сводку</button>
     <button type="button" className="btn secondary" onClick={()=>downloadCsv(`investor=csv&period=${period}&paid=${paidOnly?1:0}&test=${excludeTest?0:1}`)} disabled={!report}><Download size={16} aria-hidden="true"/>CSV</button>
    </div>
   </div>
   <div className="inv-controls no-print">
    <div className="admin-segment" role="group" aria-label="Период">{investorPeriods.map(item=><button type="button" key={item.id} aria-pressed={period===item.id} className={period===item.id?'active':''} onClick={()=>setPeriod(item.id)}>{item.label}</button>)}</div>
    <label className="inv-toggle"><input type="checkbox" checked={paidOnly} onChange={event=>setPaidOnly(event.target.checked)}/><span>Только оплаченные</span></label>
    <label className="inv-toggle"><input type="checkbox" checked={excludeTest} onChange={event=>setExcludeTest(event.target.checked)}/><span>Без тестовых аккаунтов{report?` (${report.testCustomers})`:''}</span></label>
    <button type="button" className="text-button inv-refresh" onClick={load} disabled={loading}><RefreshCw size={14} aria-hidden="true"/>{loading?'Загружаем…':'Обновить'}</button>
   </div>
   <p className="inv-print-filters print-only">{report?`Период: ${report.period.label.toLowerCase()} · ${paidOnly?'только оплаченные':'все неотменённые заказы'} · ${excludeTest?'без тестовых аккаунтов':'включая тестовые аккаунты'}`:''}</p>
  </section>
  <div className="inv-honesty" role="note"><ShieldCheck aria-hidden="true"/><span><b>Честно:</b> {honestyNote}{report?` Данные из базы Atlas на ${dateOnly(report.computedAt)}.`:''}</span></div>
  {loadError&&<p className="notice error" role="alert">{loadError}</p>}
  {!report&&!loadError&&<p className="micro" role="status">Собираем снимок…</p>}
  {report&&<>
   <Kpis report={report}/>
   <MonthlyChart report={report}/>
   <div className="inv-two">
    <UnitEconomics report={report}/>
    <Funnel report={report}/>
   </div>
   <section className="surface admin-section inv-card">
    <div className="admin-section-head"><div><h2>География и ассортимент</h2><p>Доля заказов за период по стране отправки, магазину (хост ссылки) и категории товара. Страна и категория берутся из документов аккаунтов{report.coverage.ordersWithCountry<report.coverage.financeRows?`: известны у ${report.coverage.ordersWithCountry} из ${report.coverage.financeRows} заказов`:''}.</p></div></div>
    <div className="inv-three">
     <ShareList title="Страны отправки" rows={report.regions}/>
     <ShareList title="Магазины" rows={report.stores}/>
     <ShareList title="Категории" rows={report.categories}/>
    </div>
   </section>
   <Customers report={report}/>
   <GrowthModel report={report} resetKey={`${period}|${paidOnly}|${excludeTest}|${report.computedAt}`}/>
   <p className="micro inv-coverage"><Info size={14} aria-hidden="true"/> Источники: книги заказов {count(report.coverage.financeRows)} строк, операционные записи {count(report.coverage.recordRows)}, клиентов {count(report.coverage.customerRows)}, документов аккаунтов прочитано {count(report.coverage.accountsRead)} (не более 200 последних). Дата «Доставлен» есть у {count(report.coverage.deliveredDates)} заказов, расходы журнала привязаны к {count(report.coverage.ledgerLinked)}. Клиенты в снимке обезличены.</p>
  </>}
 </div>;
}

function Delta({value,invert=false}:{value:number|null;invert?:boolean}){
 if(value===null)return <small className="inv-delta inv-delta-none">нет базы для сравнения</small>;
 const up=value>=0,good=invert?!up:up;
 return <small className={`inv-delta ${good?'inv-delta-good':'inv-delta-bad'}`}><span aria-hidden="true">{up?'▲':'▼'}</span><span className="sr-only">{up?'рост на':'снижение на'}</span> {Math.abs(Math.round(value*100))} % к прошлому периоду</small>;
}

function Kpis({report}:{report:InvestorReport}){
 const k=report.kpis.current;
 return <section className="surface admin-section inv-card">
  <div className="admin-section-head"><div><h2>Ключевые цифры</h2><p>За {report.period.label.toLowerCase()}{report.kpis.previous?` против предыдущих ${report.period.label.toLowerCase()}`:' — всё время, сравнивать не с чем'}. «Оплачено» — отметка в Atlas.</p></div><span className="admin-count">{count(k.orders)} заказов · {count(k.paidOrders)} оплачено</span></div>
  <div className="inv-kpis">
   {kpiCards.map(card=><article key={card.key}><span>{card.label}</span><strong>{card.format(k[card.key])}</strong><Delta value={report.kpis.change[card.key]} invert={card.invert}/><small>{card.hint}</small></article>)}
  </div>
 </section>;
}

function MonthlyChart({report}:{report:InvestorReport}){
 const months=report.months,width=720,height=220,left=8,right=8,bottom=28,top=12;
 const maxGmv=Math.max(1,...months.map(point=>point.gmv)),maxRevenue=Math.max(1,...months.map(point=>point.revenue));
 const step=(width-left-right)/months.length,bar=Math.max(6,step*0.56);
 const y=(value:number,max:number)=>top+(height-top-bottom)*(1-value/max);
 const line=months.map((point,index)=>`${index?'L':'M'}${(left+step*index+step/2).toFixed(1)} ${y(point.revenue,maxRevenue).toFixed(1)}`).join(' ');
 const total=months.reduce((sum,point)=>sum+point.gmv,0),revenue=months.reduce((sum,point)=>sum+point.revenue,0);
 return <section className="surface admin-section inv-card">
  <div className="admin-section-head"><div><h2>Динамика по месяцам</h2><p>Последние 12 календарных месяцев по дате оформления заказа. Столбики — GMV, линия — выручка Atlas по отметкам «оплачено» (своя шкала справа). Наведите на столбик, чтобы увидеть суммы.</p></div><span className="admin-count">12 мес: GMV {compactSum(total)} · выручка {compactSum(revenue)}</span></div>
  <figure className="inv-chart">
   <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={'GMV и выручка по месяцам: '+months.map(point=>`${monthLabel(point.month)} GMV ${money(point.gmv)}, выручка ${money(point.revenue)}, заказов ${point.orders}`).join('; ')}>
    {[0.25,0.5,0.75,1].map(share=><line key={share} className="inv-grid" x1={left} x2={width-right} y1={y(maxGmv*share,maxGmv)} y2={y(maxGmv*share,maxGmv)}/>)}
    {months.map((point,index)=>{const x=left+step*index+(step-bar)/2,h=Math.max(point.gmv>0?2:0,y(0,maxGmv)-y(point.gmv,maxGmv));return <g key={point.month} className="inv-bar-group">
     <title>{`${monthLabel(point.month)}: GMV ${money(point.gmv)}, выручка Atlas ${money(point.revenue)}, заказов ${point.orders} (оплачено ${point.paidOrders}), новых клиентов ${point.newCustomers}`}</title>
     <rect className="inv-bar" x={x} y={y(0,maxGmv)-h} width={bar} height={h} rx={3}/>
     <text className="inv-axis" x={left+step*index+step/2} y={height-8} textAnchor="middle">{monthLabel(point.month)}</text>
    </g>})}
    <path className="inv-line" d={line}/>
    {months.map((point,index)=>point.revenue>0&&<circle key={point.month} className="inv-dot" cx={left+step*index+step/2} cy={y(point.revenue,maxRevenue)} r={3}><title>{`${monthLabel(point.month)}: выручка Atlas ${money(point.revenue)}`}</title></circle>)}
    <text className="inv-axis inv-axis-left" x={left} y={top+10}>{compactSum(maxGmv)}</text>
    <text className="inv-axis inv-axis-right" x={width-right} y={top+10} textAnchor="end">{compactSum(maxRevenue)}</text>
   </svg>
   <figcaption><span><i className="inv-legend-bar" aria-hidden="true"/>GMV (шкала слева)</span><span><i className="inv-legend-line" aria-hidden="true"/>Выручка Atlas (шкала справа)</span></figcaption>
  </figure>
  <div className="inv-scroll"><table className="inv-table inv-months-table"><thead><tr><th scope="col">Месяц</th><th scope="col">Заказы</th><th scope="col">Оплачено</th><th scope="col">GMV</th><th scope="col">Выручка</th><th scope="col">Новые клиенты</th></tr></thead>
   <tbody>{months.map(point=><tr key={point.month}><th scope="row">{monthLabel(point.month)}</th><td>{point.orders}</td><td>{point.paidOrders}</td><td>{money(point.gmv)}</td><td>{money(point.revenue)}</td><td>{point.newCustomers}</td></tr>)}</tbody></table></div>
 </section>;
}

function UnitEconomics({report}:{report:InvestorReport}){
 const u=report.unit;
 const rows:Array<{label:string;value:number;tone:'transit'|'income'|'expense'|'total'}>=[
  {label:'Товар (транзит магазину)',value:u.goods,tone:'transit'},{label:'Доставка магазина (транзит)',value:u.storeShipping,tone:'transit'},
  {label:'Комиссия Atlas',value:u.commission,tone:'income'},{label:'Международная доставка',value:u.delivery,tone:'income'},{label:'Курсовая наценка',value:u.fxGain,tone:'income'},{label:'Услуги',value:u.services,tone:'income'},
  {label:'Доход Atlas с заказа',value:u.revenue,tone:'total'},{label:'Расходы журнала на заказ',value:-u.linkedExpenses,tone:'expense'},{label:'Вклад на заказ',value:u.contribution,tone:'total'},
 ];
 const max=Math.max(1,...rows.map(row=>Math.abs(row.value)));
 return <section className="surface admin-section inv-card">
  <div className="admin-section-head"><div><h2>Юнит-экономика среднего заказа</h2><p>{u.basis==='paid'?`Средние по ${count(u.count)} оплаченным заказам периода.`:`Отметок «оплачено» за период нет: средние по ${count(u.count)} сметам неотменённых заказов.`} Транзит — деньги магазина, не доход Atlas. Расходы — записи журнала, привязанные к заказам (перевозчик, платёжка…){u.linkedExpenses?'':'; пока не привязаны'}.</p></div></div>
  {u.count?<ol className="inv-bars">{rows.map(row=><li key={row.label} className={`inv-bar-row inv-tone-${row.tone}`}><span>{row.label}</span><i aria-hidden="true" style={{width:`${Math.max(1,Math.round(Math.abs(row.value)/max*100))}%`}}/><b>{row.value<0?'−':''}{money(Math.abs(row.value))}</b></li>)}</ol>:<p className="micro">За период заказов нет.</p>}
 </section>;
}

function Funnel({report}:{report:InvestorReport}){
 const f=report.funnel,max=Math.max(1,...f.steps.map(step=>step.count));
 return <section className="surface admin-section inv-card">
  <div className="admin-section-head"><div><h2>Воронка и операционка</h2><p>Клиентов на каждом шаге за период. Корзины — по текущим документам аккаунтов (у корзины нет даты), остальное — по заказам периода.</p></div><span className="admin-count">{count(f.cancelled)} отменено</span></div>
  <ol className="inv-bars inv-funnel">{f.steps.map((step,index)=><li key={step.id} className="inv-bar-row inv-tone-income"><span>{step.label}</span><i aria-hidden="true" style={{width:`${Math.max(1,Math.round(step.count/max*100))}%`}}/><b>{count(step.count)}{index>0&&f.steps[0].count?<small> {pct(step.count/f.steps[0].count,0)}</small>:null}</b></li>)}</ol>
  <dl className="inv-facts">
   <div><dt>Средний срок от заказа до «Доставлен»</dt><dd>{f.averageDeliveryDays===null?'нет данных — доставленных заказов с датой события пока нет':`${f.averageDeliveryDays.toLocaleString('ru-RU')} дн. по ${count(f.deliveredWithDates)} заказам`}</dd></div>
   <div><dt>Отменённых заказов за период</dt><dd>{count(f.cancelled)}</dd></div>
  </dl>
 </section>;
}

function ShareList({title,rows}:{title:string;rows:ShareRow[]}){
 return <div className="inv-share"><h3>{title}</h3>{rows.length?<ol className="inv-bars">{rows.map(row=><li key={row.label} className="inv-bar-row inv-tone-income"><span title={row.label}>{row.label}</span><i aria-hidden="true" style={{width:`${Math.max(1,Math.round(row.share*100))}%`}}/><b>{pct(row.share,0)}<small> {count(row.orders)} · {compactSum(row.gmv)}</small></b></li>)}</ol>:<p className="micro">За период заказов нет.</p>}</div>;
}

function Customers({report}:{report:InvestorReport}){
 const months=report.months,maxNew=Math.max(1,...months.map(point=>point.newCustomers));
 return <section className="surface admin-section inv-card">
  <div className="admin-section-head"><div><h2>Клиенты</h2><p>Новые клиенты — по месяцу первого неотменённого заказа. Когорты: какая доля клиентов месяца сделала ещё один заказ в течение 1, 2 и 3 следующих месяцев; пустая клетка — срок ещё не прошёл.</p></div></div>
  <div className="inv-two inv-two-customers">
   <div>
    <h3>Новые клиенты по месяцам</h3>
    <ol className="inv-columns" aria-label={'Новые клиенты по месяцам: '+months.map(point=>`${monthLabel(point.month)} ${point.newCustomers}`).join(', ')}>{months.map(point=><li key={point.month}><b>{point.newCustomers||''}</b><i aria-hidden="true" style={{height:`${Math.max(2,Math.round(point.newCustomers/maxNew*100))}%`}}/><span>{monthLabel(point.month)}</span></li>)}</ol>
   </div>
   <div>
    <h3>Удержание по когортам</h3>
    <div className="inv-scroll"><table className="inv-table inv-cohorts"><thead><tr><th scope="col">Месяц первого заказа</th><th scope="col">Клиентов</th><th scope="col">1 мес</th><th scope="col">2 мес</th><th scope="col">3 мес</th></tr></thead>
     <tbody>{report.cohorts.filter(cohort=>cohort.customers>0).map(cohort=><tr key={cohort.month}><th scope="row">{monthLabel(cohort.month)}</th><td>{cohort.customers}</td>{cohort.retained.map((value,index)=><td key={index} className={value===null?'inv-heat-none':'inv-heat'} style={value===null?undefined:{'--heat':Math.max(0.08,value)} as CSSProperties}>{value===null?'':pct(value,0)}</td>)}</tr>)}
     {!report.cohorts.some(cohort=>cohort.customers>0)&&<tr><td colSpan={5} className="micro">За 12 месяцев новых клиентов нет.</td></tr>}</tbody></table></div>
   </div>
  </div>
 </section>;
}

function GrowthModel({report,resetKey}:{report:InvestorReport;resetKey:string}){
 const [assumptions,setAssumptions]=useState<GrowthAssumptions>(()=>defaultAssumptions(report.months,report.kpis.current)),[edited,setEdited]=useState(false),[seenKey,setSeenKey]=useState(resetKey);
 // A new period or filter re-fills the assumptions from the facts unless the viewer edited them; tracked during render, not in an effect.
 if(resetKey!==seenKey){setSeenKey(resetKey);if(!edited)setAssumptions(defaultAssumptions(report.months,report.kpis.current))}
 const model=useMemo(()=>growthModel(assumptions),[assumptions]);
 const set=(key:keyof GrowthAssumptions,raw:string)=>{const value=Number(raw.replace(',','.'));setEdited(true);setAssumptions(current=>clampAssumptions({...current,[key]:key==='takeRate'?value/100:value}))};
 const reset=()=>{setEdited(false);setAssumptions(defaultAssumptions(report.months,report.kpis.current))};
 return <section className="surface admin-section inv-card inv-model">
  <div className="admin-section-head"><div><h2>Модель роста <span className="inv-tag">модель, не прогноз компании</span></h2><p>Арифметика на допущениях ниже: заказов в месяц × (1 + рост)ᵐ × средний чек × take rate. Предзаполнено фактом периода; меняйте поля — ничего не сохраняется.</p></div><button type="button" className="text-button no-print" onClick={reset} disabled={!edited}>Вернуть факт</button></div>
  <div className="inv-assumptions">
   <label className="field"><span>Заказов в месяц сейчас</span><input type="number" inputMode="decimal" min="0" step="1" value={assumptions.ordersPerMonth} onChange={event=>set('ordersPerMonth',event.target.value)}/><small>факт: среднее за 3 полных месяца</small></label>
   <label className="field"><span>Рост, % в месяц</span><input type="number" inputMode="decimal" min="-50" max="100" step="1" value={assumptions.growthPct} onChange={event=>set('growthPct',event.target.value)}/><small>факт: медиана роста заказов за 4 мес</small></label>
   <label className="field"><span>Средний чек, сум</span><input type="number" inputMode="numeric" min="0" step="1000" value={assumptions.averageCheck} onChange={event=>set('averageCheck',event.target.value)}/><small>факт: GMV / заказы периода</small></label>
   <label className="field"><span>Take rate, %</span><input type="number" inputMode="decimal" min="0" max="100" step="0.1" value={Math.round(assumptions.takeRate*1000)/10} onChange={event=>set('takeRate',event.target.value)}/><small>факт: выручка / оплаченный GMV</small></label>
  </div>
  <div className="inv-scroll"><table className="inv-table inv-model-table"><thead><tr><th scope="col">Месяц</th><th scope="col">Заказы</th><th scope="col">GMV</th><th scope="col">Выручка Atlas</th></tr></thead>
   <tbody>{model.rows.map(row=><tr key={row.index}><th scope="row">+{row.index}</th><td>{row.orders.toLocaleString('ru-RU',{maximumFractionDigits:1})}</td><td>{money(row.gmv)}</td><td>{money(row.revenue)}</td></tr>)}</tbody>
   <tfoot><tr><th scope="row">12 месяцев</th><td>{count(model.totalOrders)}</td><td>{money(model.totalGmv)}</td><td>{money(model.totalRevenue)}</td></tr></tfoot></table></div>
  <p className="micro">Модель не учитывает отмены, сезонность, расходы и ёмкость рынка. Это иллюстрация допущений, а не обязательство и не прогноз Atlas.</p>
 </section>;
}
