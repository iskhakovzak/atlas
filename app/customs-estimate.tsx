'use client';
import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import Link from '@/components/site-link';
import { estimateCourierCustoms } from '@/lib/market/customs';
import type { Locale } from '@/lib/market/i18n';

const labels = {
  ru: { title:'Таможня, ориентир', from:'от', unavailable:'Уточните данные', assumption:'Лимит $200 в календарный месяц', separate:'Не входит в сумму Atlas', used:'Уже ввезено в месяц прибытия, USD', date:'Дата прибытия на таможню', extra:'Дополнительно в таможенную стоимость, USD', extraHint:'Например, расходы, которые перевозчик включает в таможенную стоимость.', base:'Стоимость товаров', excess:'Превышение лимита', rule:'Ориентир', minimum:'минимум', perKg:'за кг', note:'Для личной курьерской посылки: учитывается только превышение месячного лимита. Стоимость и облагаемый вес подтверждает таможня; итог может отличаться.', rateNote:'Сводная редакция ПП-4508 на 01.09.2026 показывает 20% и минимум $2/кг, но УП-174 прямо указывает дату начала 01.01.2027. Из-за расхождения это только ориентир; ставку уточняет таможня.', details:'Условия и источники', adjust:'Уточнить данные месяца', how:'Как считается', invalid:'Введите неотрицательные суммы и корректную дату не ранее 01.05.2025.', calculator:'Оценить таможенный платёж', value:'Стоимость товаров, USD', weight:'Вес отправления с упаковкой, кг' },
  uz: { title:'Taxminiy bojxona to‘lovi', from:'dan', unavailable:'Ma’lumotlarni tekshiring', assumption:'Kalendar oyida $200 limit', separate:'Atlas summasiga kiritilmagan', used:'Kelish oyida avval olib kirilgan, USD', date:'Bojxonaga kelish sanasi', extra:'Bojxona qiymatiga qo‘shimcha, USD', extraHint:'Masalan, tashuvchi bojxona qiymatiga kiritadigan xarajatlar.', base:'Mahsulotlar qiymati', excess:'Limitdan oshgan qism', rule:'Taxminiy stavka', minimum:'kamida', perKg:'har kg uchun', note:'Shaxsiy kuryer jo‘natmasi uchun: faqat oylik limitdan oshgan qism hisoblanadi. Qiymat va soliq solinadigan vaznni bojxona tasdiqlaydi; yakuniy summa farq qilishi mumkin.', rateNote:'PP-4508 ning 01.09.2026 dagi jamlangan tahririda 20% va kamida $2/kg ko‘rsatilgan, ammo PF-174 da boshlanish sanasi 01.01.2027 deb belgilangan. Tafovut sabab bu faqat taxmin; amaldagi stavkani bojxona tasdiqlaydi.', details:'Shartlar va manbalar', adjust:'Oy ma’lumotlarini aniqlashtirish', how:'Qanday hisoblanadi', invalid:'Manfiy bo‘lmagan summalar va 01.05.2025 dan keyingi to‘g‘ri sanani kiriting.', calculator:'Bojxona to‘lovini hisoblash', value:'Mahsulotlar qiymati, USD', weight:'Qadoq bilan jo‘natma vazni, kg' },
  en: { title:'Estimated customs', from:'from', unavailable:'Check the inputs', assumption:'$200 per calendar month', separate:'Not included in the Atlas amount', used:'Already imported in the arrival month, USD', date:'Expected customs arrival date', extra:'Additional customs value, USD', extraHint:'For example, costs your carrier includes in customs value.', base:'Merchandise value', excess:'Value above allowance', rule:'Estimate', minimum:'minimum', perKg:'per kg', note:'Personal courier parcels only: this counts the amount above the monthly allowance. Customs confirms value and dutiable weight; the final amount may differ.', rateNote:'The consolidated PP-4508 text dated 2026-09-01 shows 20% / $2 per kg, while UP-174 expressly names 2027-01-01 as the start date. Because the dates conflict, this is only an estimate; Customs confirms the applicable rate.', details:'Conditions and sources', adjust:'Refine monthly inputs', how:'How it is estimated', invalid:'Enter non-negative amounts and a valid date on or after 2025-05-01.', calculator:'Estimate customs charges', value:'Merchandise value, USD', weight:'Gross shipment weight, kg' },
};
labels.ru.assumption = 'Ориентир: лимит $200 за этот месяц ещё полностью доступен';
labels.uz.assumption = 'Taxmin: bu oy uchun $200 limit hali to‘liq mavjud';
labels.en.assumption = 'Assumes the full $200 monthly allowance remains';
export function CustomsEstimate({ valueUsd, grossKg, fx, locale = 'ru', compact = false }: { valueUsd: number; grossKg?: number; fx: number; locale?: Locale; compact?: boolean }) {
  const id = useId(), copy = labels[locale];
  const [used, setUsed] = useState('0'), [extra, setExtra] = useState('0');
  const [date, setDate] = useState(() => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const rateUnconfirmed = courierRateNeedsConfirmation(date);
  const estimate = estimateCourierCustoms({ valueUsd: valueUsd + (extra.trim() ? Number(extra) : NaN), usedUsd: used.trim() ? Number(used) : NaN, grossKg, date });
  const format = (usd: number) => new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', { maximumFractionDigits:0 }).format(Math.round(usd * fx)) + (locale === 'ru' ? ' сум' : locale === 'uz' ? ' so‘m' : ' UZS');
  const result = !estimate ? copy.unavailable : estimate.upperUsd === undefined ? copy.from + ' ' + format(estimate.lowerUsd) : estimate.upperUsd > estimate.lowerUsd ? format(estimate.lowerUsd) + ' – ' + format(estimate.upperUsd) : '≈ ' + format(estimate.lowerUsd);
  if (compact) return <div className="customs-estimate-wrap customs-estimate-compact">
    <div className="customs-compact-row">
      <div className="customs-compact-copy"><strong>{copy.title}</strong><small>{copy.assumption}</small></div>
      <strong className="customs-compact-result">{result}</strong>
      <details className="customs-estimate-help">
        <summary aria-label={copy.how} title={copy.how}><Info size={16}/></summary>
        <div className="customs-estimate-popover">
          <p>{copy.note}</p>
          {estimate && <p>{copy.rule}: {estimate.rate * 100}% · {copy.minimum} ${estimate.minimumPerKg}/{locale === 'ru' ? 'кг' : 'kg'}.</p>}
          <p>{copy.rateNote}</p>
          <Link className="text-link" href="/customs">{copy.adjust} ↗</Link>
        </div>
      </details>
    </div>
    <small className="customs-compact-note">{copy.separate}</small>
  </div>;
  return <div className="customs-estimate-wrap"><details className="customs-estimate"><summary><span>{copy.title}</span><strong>{result}</strong></summary>
    <div className="customs-estimate-body"><p className="micro">{Number(used) === 0 ? copy.assumption + '. ' : ''}{copy.separate}.</p>
      <details className="customs-estimate-inputs"><summary>{copy.adjust}</summary><div>
        <div className="field"><label htmlFor={id+'-used'}>{copy.used}</label><input id={id+'-used'} type="number" min="0" step="0.01" value={used} onChange={e=>setUsed(e.target.value)}/></div>
        <div className="field"><label htmlFor={id+'-date'}>{copy.date}</label><input id={id+'-date'} type="date" min="2025-05-01" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="field"><label htmlFor={id+'-extra'}>{copy.extra}</label><input id={id+'-extra'} type="number" min="0" step="0.01" value={extra} onChange={e=>setExtra(e.target.value)}/><small>{copy.extraHint}</small></div>
      </div></details>
      {estimate ? <dl className="cost-lines"><div><dt>{copy.base}</dt><dd>${valueUsd.toFixed(2)}</dd></div><div><dt>{copy.excess}</dt><dd>${estimate.excessUsd.toFixed(2)}</dd></div><div><dt>{copy.rule}</dt><dd>{estimate.rate*100}% · {copy.minimum} ${estimate.minimumPerKg} {copy.perKg}</dd></div></dl> : <p role="alert">{copy.invalid}</p>}
      <p className="micro">{copy.note}</p><p className="micro">{copy.rateNote}</p><Link className="text-link" href="/customs">{copy.details} ↗</Link>
    </div></details><span className="customs-estimate-caption">{copy.separate}</span>
  </div>;
}

export function CustomsCalculator({fx,locale='ru'}:{fx:number;locale?:Locale}) {
  const [value,setValue]=useState('300'),[weight,setWeight]=useState('1');const id=useId(),copy=labels[locale];
  return <section className="surface"><h2>{copy.calculator}</h2><div className="two-fields"><div className="field"><label htmlFor={id+'-value'}>{copy.value}</label><input id={id+'-value'} type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)}/></div><div className="field"><label htmlFor={id+'-weight'}>{copy.weight}</label><input id={id+'-weight'} type="number" min="0.01" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></div></div><CustomsEstimate valueUsd={value.trim()?Number(value):NaN} grossKg={weight.trim()?Number(weight):undefined} fx={fx} locale={locale}/></section>;
}
