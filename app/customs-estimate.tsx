'use client';
import { useId, useState } from 'react';
import { ChevronDown, Info, ShieldCheck } from 'lucide-react';
import Link from '@/components/site-link';
import { courierAllowanceUsd, estimateCourierCustoms } from '@/lib/market/customs';
import type { Pricing } from '@/lib/market/domain';
import type { Locale } from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import {formatPercent,formatSum,formatUsd} from '@/lib/market/format';

/** The tariff's customs settings: the allowance, rate and per-kg minimum the operator set (empty = the law's). */
type CustomsPricing = Partial<Pick<Pricing, 'customsAllowanceUsd' | 'customsRate' | 'customsMinimumPerKg'>>;
const labels = /*@__PURE__*/withCyrillic({
  ru: { title:'Расчёт таможенного платежа', result:'Таможенный платёж', free:'Пошлины нет', left:(left:string,limit:string)=>`С этой покупкой в месяце останется ${left} из ${limit}`, allowanceLink:'Лимит в кабинете', from:'от', unavailable:'Уточните данные', assumption:(limit:string)=>`Расчёт исходит из того, что лимит ${limit} за этот месяц ещё не использован`, separate:'Платится отдельно от заказа — или вместе с ним, если выберете «Atlas оплатит таможню»', used:'Уже ввезено в месяц прибытия, USD', date:'Дата прибытия на таможню', extra:'Дополнительно в таможенную стоимость, USD', extraHint:'Например, расходы, которые перевозчик включает в таможенную стоимость.', base:'Стоимость товаров', excess:'Превышение лимита', rule:'Ставка', minimum:'минимум', perKg:'за кг', note:'Для личной курьерской посылки: учитывается только превышение месячного лимита. Окончательную сумму по стоимости и облагаемому весу начисляет таможня.', rateNote:'Сводная редакция ПП-4508 на 01.09.2026 показывает 20% и минимум $2/кг, но УП-174 прямо указывает дату начала 01.01.2027. Пока даты расходятся, калькулятор считает по 20% и $2/кг; окончательную ставку определяет таможня.', adjust:'Уточнить данные месяца', how:'Как считается', invalid:'Введите неотрицательные суммы и корректную дату не ранее 01.05.2025.', calculator:'Рассчитать таможенный платёж', value:'Стоимость товаров, USD', weight:'Вес отправления с упаковкой, кг' },
  uz: { title:'Bojxona to‘lovi hisobi', result:'Bojxona to‘lovi', free:'Boj yo‘q', left:(left:string,limit:string)=>`Bu xarid bilan shu oy ${limit} dan ${left} qoladi`, allowanceLink:'Kabinetdagi limit', from:'dan', unavailable:'Ma’lumotlarni tekshiring', assumption:(limit:string)=>`Hisob bu oy uchun ${limit} limit hali ishlatilmagan deb olingan`, separate:'Buyurtmadan alohida to‘lanadi — yoki «Bojxonani Atlas to‘laydi» tanlansa, u bilan birga', used:'Kelish oyida avval olib kirilgan, USD', date:'Bojxonaga kelish sanasi', extra:'Bojxona qiymatiga qo‘shimcha, USD', extraHint:'Masalan, tashuvchi bojxona qiymatiga kiritadigan xarajatlar.', base:'Mahsulotlar qiymati', excess:'Limitdan oshgan qism', rule:'Stavka', minimum:'kamida', perKg:'har kg uchun', note:'Shaxsiy kuryer jo‘natmasi uchun: faqat oylik limitdan oshgan qism hisoblanadi. Yakuniy summani qiymat va soliq solinadigan vazn bo‘yicha bojxona hisoblaydi.', rateNote:'PP-4508 ning 01.09.2026 dagi jamlangan tahririda 20% va kamida $2/kg ko‘rsatilgan, ammo PF-174 da boshlanish sanasi 01.01.2027 deb belgilangan. Sanalar mos kelmaguncha kalkulyator 20% va $2/kg bo‘yicha hisoblaydi; yakuniy stavkani bojxona belgilaydi.', adjust:'Oy ma’lumotlarini aniqlashtirish', how:'Qanday hisoblanadi', invalid:'Manfiy bo‘lmagan summalar va 01.05.2025 dan keyingi to‘g‘ri sanani kiriting.', calculator:'Bojxona to‘lovini hisoblash', value:'Mahsulotlar qiymati, USD', weight:'Qadoq bilan jo‘natma vazni, kg' },
  en: { title:'Customs payment calculation', result:'Customs payment', free:'No duty', left:(left:string,limit:string)=>`${left} of ${limit} left this month with this purchase`, allowanceLink:'Allowance in your account', from:'from', unavailable:'Check the inputs', assumption:(limit:string)=>`Assumes the full ${limit} monthly allowance remains`, separate:'Paid separately from the order — or with it if you choose “Atlas pays customs”', used:'Already imported in the arrival month, USD', date:'Expected customs arrival date', extra:'Additional customs value, USD', extraHint:'For example, costs your carrier includes in customs value.', base:'Merchandise value', excess:'Value above allowance', rule:'Rate', minimum:'minimum', perKg:'per kg', note:'Personal courier parcels only: this counts the amount above the monthly allowance. Customs sets the final amount from the value and dutiable weight.', rateNote:'The consolidated PP-4508 text dated 2026-09-01 shows 20% / $2 per kg, while UP-174 expressly names 2027-01-01 as the start date. While the dates disagree, the calculator uses 20% and $2 per kg; customs sets the final rate.', adjust:'Refine monthly inputs', how:'How it is calculated', invalid:'Enter non-negative amounts and a valid date on or after 2025-05-01.', calculator:'Calculate customs charges', value:'Merchandise value, USD', weight:'Gross shipment weight, kg' },
});
// Prefilled from this month's Atlas orders for the same recipient; the customer can still adjust it.
const counted = /*@__PURE__*/withCyrillic({
  ru: (usd: number) => `Учтено $${usd}, уже заказанных этому получателю в этом месяце через Atlas`,
  uz: (usd: number) => `Shu oy Atlas orqali bu qabul qiluvchiga buyurtma qilingan $${usd} hisobga olindi`,
  en: (usd: number) => `Counts $${usd} already ordered for this recipient this month through Atlas`,
});
export function CustomsEstimate({ valueUsd, grossKg, fx, pricing, locale = 'ru', compact = false, initialUsedUsd = 0, accountLink = false }: { valueUsd: number; grossKg?: number; fx: number; pricing?: CustomsPricing; locale?: Locale; compact?: boolean; initialUsedUsd?: number; /** A signed-in customer: link to the allowance card in the account. */ accountLink?: boolean }) {
  const id = useId(), copy = labels[locale];
  // The allowance in the labels is the one estimateCourierCustoms() counts with: the tariff's, else the law's $200.
  const assumption = copy.assumption(`$${pricing?.customsAllowanceUsd ?? courierAllowanceUsd}`);
  const [used, setUsed] = useState(String(initialUsedUsd)), [extra, setExtra] = useState('0');
  const [date, setDate] = useState(() => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const extraUsd = extra.trim() ? Number(extra) : NaN;
  const estimate = estimateCourierCustoms({ valueUsd: valueUsd + extraUsd, usedUsd: used.trim() ? Number(used) : NaN, grossKg, date, pricing });
  // Soum amounts as everywhere on the site: space-grouped digits in every language ("245 420 so‘m", never "245,420").
  const format = (usd: number) => formatSum(Math.round(usd * fx), locale);
  // Each amount keeps its digits and «сум» on one line; only a range may break, after the dash.
  const amount = (usd: number) => format(usd).replace(/\s/g, '\u00a0');
  const result = !estimate ? copy.unavailable : estimate.upperUsd === undefined ? copy.from + '\u00a0' + amount(estimate.lowerUsd) : estimate.upperUsd > estimate.lowerUsd ? amount(estimate.lowerUsd) + ' – ' + amount(estimate.upperUsd) : '≈\u00a0' + amount(estimate.lowerUsd);
  if (compact) return <div className="customs-estimate-wrap customs-estimate-compact">
    <div className="customs-compact-row">
      <div className="customs-compact-copy"><strong>{copy.title}</strong><small>{assumption}</small></div>
      <strong className="customs-compact-result">{result}</strong>
      <details className="customs-estimate-help">
        <summary aria-label={copy.how} title={copy.how}><Info size={16}/></summary>
        <div className="customs-estimate-popover">
          <p>{copy.note}</p>
          {estimate && <p>{copy.rule}: {formatPercent(estimate.rate, locale)} · {copy.minimum} ${estimate.minimumPerKg} {copy.perKg}.</p>}
          <p>{copy.rateNote}</p>
          <Link className="text-link" href="/customs">{copy.adjust} ↗</Link>
        </div>
      </details>
    </div>
    <small className="customs-compact-note">{copy.separate}</small>
  </div>;
  // The full calculator (/customs): the payment in large type right away; no excess reads "No duty" with the month's
  // allowance as a bar, as in the cart (app/calc-summary.tsx), instead of "≈ 0 сум". The inputs and the method stay folded.
  const free = estimate !== null && estimate.excessUsd === 0;
  const leftUsd = estimate ? Math.max(0, estimate.remainingUsd - (valueUsd + extraUsd)) : 0;
  const usedLine = Number(used) === 0 ? assumption : Number(used) === initialUsedUsd ? counted[locale](initialUsedUsd) : '';
  return <div className="customs-estimate-wrap"><div className="customs-result">
    <div className="customs-result-head" role="status" aria-live="polite">
      <span className="customs-result-label">{copy.result}</span>
      {free ? <>
        <header className="calc-customs-none"><ShieldCheck size={18} aria-hidden="true"/><h3>{copy.free}</h3></header>
        <div className="calc-customs-meter"><span className="calc-customs-track" aria-hidden="true"><span style={{width:`${estimate.allowanceUsd>0?Math.min(100,Math.max(3,(1-leftUsd/estimate.allowanceUsd)*100)):100}%`}}/></span>
          <p>{copy.left(formatUsd(leftUsd,locale),formatUsd(estimate.allowanceUsd,locale))}</p></div>
      </> : <strong className="customs-result-amount">{result}</strong>}
    </div>
    {usedLine && <p className="micro customs-result-note">{usedLine}</p>}
    {accountLink && <Link className="text-link customs-result-account" href="/account">{copy.allowanceLink}</Link>}
    {!estimate ? <p role="alert">{copy.invalid}</p> : !free && <dl className="cost-lines customs-result-lines"><div><dt>{copy.base}</dt><dd>{formatUsd(valueUsd, locale)}</dd></div><div><dt>{copy.excess}</dt><dd>{formatUsd(estimate.excessUsd, locale)}</dd></div><div><dt>{copy.rule}</dt><dd>{formatPercent(estimate.rate,locale)} · {copy.minimum} ${estimate.minimumPerKg} {copy.perKg}</dd></div></dl>}
    <span className="customs-estimate-caption">{copy.separate}</span>
    <div className="customs-estimate-body">
      <details className="customs-estimate-inputs"><summary>{copy.adjust}<ChevronDown className="customs-chevron" size={18} aria-hidden="true"/></summary><div>
        <div className="field"><label htmlFor={id+'-used'}>{copy.used}</label><input id={id+'-used'} type="number" min="0" step="0.01" value={used} onChange={e=>setUsed(e.target.value)}/></div>
        <div className="field"><label htmlFor={id+'-date'}>{copy.date}</label><input id={id+'-date'} type="date" min="2025-05-01" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="field"><label htmlFor={id+'-extra'}>{copy.extra}</label><input id={id+'-extra'} type="number" min="0" step="0.01" value={extra} onChange={e=>setExtra(e.target.value)}/><small>{copy.extraHint}</small></div>
      </div></details>
      <details className="customs-estimate-how"><summary>{copy.how}<ChevronDown className="customs-chevron" size={18} aria-hidden="true"/></summary><div>
        <p className="micro">{copy.note}</p><p className="micro">{copy.rateNote}</p>
      </div></details>
    </div>
  </div></div>;
}

/** `usedUsd`: a signed-in customer's counted Atlas orders this month (catalogAllowance), prefilled and still editable;
 * undefined for a guest. The key re-creates the estimate once the account has loaded, so its state picks the value up. */
export function CustomsCalculator({pricing,locale='ru',usedUsd}:{pricing:CustomsPricing&Pick<Pricing,'fx'>;locale?:Locale;usedUsd?:number}) {
  const [value,setValue]=useState('300'),[weight,setWeight]=useState('1');const id=useId(),copy=labels[locale];
  return <section className="surface customs-calc"><h2>{copy.calculator}</h2><div className="two-fields"><div className="field"><label htmlFor={id+'-value'}>{copy.value}</label><input id={id+'-value'} type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)}/></div><div className="field"><label htmlFor={id+'-weight'}>{copy.weight}</label><input id={id+'-weight'} type="number" min="0.01" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></div></div><CustomsEstimate key={usedUsd??0} valueUsd={value.trim()?Number(value):NaN} grossKg={weight.trim()?Number(weight):undefined} fx={pricing.fx} pricing={pricing} locale={locale} initialUsedUsd={usedUsd??0} accountLink={usedUsd!==undefined}/></section>;
}
