'use client';

import { useEffect, useState } from 'react';
import { parsePerformanceSamples, performanceStorageKey, performanceUpdateEvent, summarizePerformanceSamples } from '@/lib/market/performance';

function value(valueMs: number | undefined, digits = 0) {
  return valueMs === undefined ? '—' : `${valueMs.toFixed(digits)}${digits ? '' : ' мс'}`;
}

export function PerformanceSummary() {
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
    {label: 'TTFB · ответ сервера', value: value(summary.ttfbMs), limit: 800, measured: summary.ttfbMs},
    {label: 'FCP · первый контент', value: value(summary.fcpMs), limit: 1800, measured: summary.fcpMs},
    {label: 'LCP · основной контент', value: value(summary.lcpMs), limit: 2500, measured: summary.lcpMs},
    {label: 'INP · реакция на ввод', value: value(summary.inpMs), limit: 200, measured: summary.inpMs},
    {label: 'CLS · сдвиг макета', value: value(summary.cls, 3), limit: 0.1, measured: summary.cls},
  ];
  return <section className="performance-summary" aria-labelledby="performance-summary-title">
    <div className="admin-section-head"><div><h3 id="performance-summary-title">Скорость интерфейса</h3><p>Локальная сводка p75 по последним {summary.sampleCount} загрузкам в этом браузере.</p></div></div>
    <div className="admin-metrics">
      {vitals.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.measured === undefined ? 'пока нет измерений' : metric.measured <= metric.limit ? 'в целевом диапазоне' : 'нужно проверить'}</small></article>)}
      <article><span>API · средняя задержка</span><strong>{value(summary.apiAverageMs)}</strong><small>{summary.apiCount} запросов · {summary.apiSlowCount} дольше 1 с</small></article>
      <article><span>API · максимум</span><strong>{value(summary.apiMaxMs)}</strong><small>URL и данные ответа не сохраняются</small></article>
    </div>
    <p className="micro">Измерения хранятся только в localStorage этого устройства и не отправляются Atlas. Локальный p75 — диагностический ориентир, не полевой отчёт по всем покупателям.</p>
  </section>;
}
