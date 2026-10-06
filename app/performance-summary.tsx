'use client';

import { useEffect, useState } from 'react';
import { parsePerformanceSamples, performanceStorageKey, performanceUpdateEvent, summarizePerformanceSamples } from '@/lib/market/performance';
import type { RouteVitals } from '@/lib/market/telemetry';

function value(valueMs: number | undefined, digits = 0) {
  return valueMs === undefined ? '—' : `${valueMs.toFixed(digits)}${digits ? '' : ' мс'}`;
}

// Core Web Vitals "good" limits at p75.
const limits = { ttfbMs: 800, fcpMs: 1800, lcpMs: 2500, inpMs: 200, cls: 0.1 } as const;
const verdict = (measured: number | undefined, limit: number) => measured === undefined ? '' : measured <= limit ? 'ok' : 'slow';

export function PerformanceSummary({ field }: { field?: { since: number; routes: RouteVitals[] } | null }) {
  const [summary, setSummary] = useState(() => summarizePerformanceSamples([]));
  useEffect(() => {
    const refresh = () => {
      try { setSummary(summarizePerformanceSamples(parsePerformanceSamples(window.localStorage.getItem(performanceStorageKey)))); }
      catch { setSummary(summarizePerformanceSamples([])); }
    };
    refresh();
    window.addEventListener(performanceUpdateEvent, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(performanceUpdateEvent, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const vitals = [
    {label: 'TTFB · ответ сервера', value: value(summary.ttfbMs), limit: limits.ttfbMs, measured: summary.ttfbMs},
    {label: 'FCP · первый контент', value: value(summary.fcpMs), limit: limits.fcpMs, measured: summary.fcpMs},
    {label: 'LCP · основной контент', value: value(summary.lcpMs), limit: limits.lcpMs, measured: summary.lcpMs},
    {label: 'INP · реакция на ввод', value: value(summary.inpMs), limit: limits.inpMs, measured: summary.inpMs},
    {label: 'CLS · сдвиг макета', value: value(summary.cls, 3), limit: limits.cls, measured: summary.cls},
  ];
  const routes = field?.routes ?? [];
  return <section className="surface admin-section performance-summary" aria-labelledby="performance-summary-title">
    <div className="admin-section-head"><div><h3 id="performance-summary-title">Скорость у покупателей</h3><p>p75 за 7 дней по страницам: анонимные замеры из браузеров посетителей.</p></div></div>
    {routes.length ? <div className="field-vitals" role="region" aria-label="Скорость по страницам" tabIndex={0}><table>
      <thead><tr><th scope="col">Страница</th><th scope="col">Замеров</th><th scope="col">Телефоны</th><th scope="col">LCP</th><th scope="col">INP</th><th scope="col">CLS</th><th scope="col">TTFB</th></tr></thead>
      <tbody>{routes.map((row) => <tr key={row.route}>
        <th scope="row">{row.route}</th><td>{row.samples}</td><td>{row.mobileShare}%</td>
        <td data-verdict={verdict(row.lcpMs, limits.lcpMs)}>{value(row.lcpMs)}</td>
        <td data-verdict={verdict(row.inpMs, limits.inpMs)}>{value(row.inpMs)}</td>
        <td data-verdict={verdict(row.cls, limits.cls)}>{value(row.cls, 3)}</td>
        <td data-verdict={verdict(row.ttfbMs, limits.ttfbMs)}>{value(row.ttfbMs)}</td>
      </tr>)}</tbody>
    </table></div> : <p className="micro">{field === null ? 'Сводка недоступна: примените миграцию 0007_web_vitals.' : 'Замеров за 7 дней пока нет.'}</p>}
    <div className="admin-section-head"><div><h3>Этот браузер</h3><p>Локальная сводка p75 по последним {summary.sampleCount} загрузкам на этом устройстве.</p></div></div>
    <div className="admin-metrics">
      {vitals.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.measured === undefined ? 'пока нет измерений' : metric.measured <= metric.limit ? 'в целевом диапазоне' : 'нужно проверить'}</small></article>)}
      <article><span>API · средняя задержка</span><strong>{value(summary.apiAverageMs)}</strong><small>{summary.apiCount} запросов · {summary.apiSlowCount} дольше 1 с</small></article>
      <article><span>API · максимум</span><strong>{value(summary.apiMaxMs)}</strong><small>URL и данные ответа не сохраняются</small></article>
    </div>
    <p className="micro">Каждый просмотр страницы отправляет Atlas один обезличенный замер: адрес страницы без параметров, тип устройства и показатели скорости, а также до пяти ошибок скриптов без персональных данных. Аккаунт, cookie и IP не сохраняются, замеры удаляются через 30 дней. Ошибки браузера и нарушения политики безопасности (CSP) видны в журнале ошибок выше с числом повторов.</p>
  </section>;
}
