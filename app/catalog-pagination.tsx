'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogCopy } from '@/lib/market/catalog-copy';
import { pageNumbers, perPageOptions } from '@/lib/market/catalog-query';

type Copy = (typeof catalogCopy)['ru'];

/**
 * "Показано 25–48 из 307", page links "‹ 1 2 3 … 26 ›" and the page size. Links carry a real address
 * (open in a new tab works); a plain click changes the page in place.
 */
export function CatalogPagination({ page, pages, start, end, total, per, href, onPage, onPer, cc }: {
  page: number; pages: number; start: number; end: number; total: number; per: number;
  href: (page: number) => string; onPage: (page: number) => void; onPer: (per: number) => void; cc: Copy;
}) {
  if (!total) return null;
  const go = (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onPage(target);
  };
  const arrow = (target: number, label: string, icon: ReactNode) => target < 1 || target > pages
    ? <span className="catalog-pager-link catalog-pager-arrow" aria-disabled="true">{icon}<span className="sr-only">{label}</span></span>
    : <a className="catalog-pager-link catalog-pager-arrow" href={href(target)} rel={target < page ? 'prev' : 'next'} onClick={go(target)}>{icon}<span className="sr-only">{label}</span></a>;
  return <nav className="catalog-pagination" aria-label={cc.pages}>
    <p className="catalog-pagination-range">{cc.range(start + 1, end, total)}</p>
    {pages > 1 && <ul>
      <li>{arrow(page - 1, cc.prevPage, <ChevronLeft size={18} aria-hidden="true" />)}</li>
      {pageNumbers(page, pages).map((value, index) => value === 'gap'
        ? <li key={'gap' + index} className="catalog-pager-gap" aria-hidden="true">…</li>
        : <li key={value}><a className="catalog-pager-link" href={href(value)} aria-label={cc.page(value)} aria-current={value === page ? 'page' : undefined} onClick={go(value)}>{value}</a></li>)}
      <li>{arrow(page + 1, cc.nextPage, <ChevronRight size={18} aria-hidden="true" />)}</li>
    </ul>}
    {total > perPageOptions[0] && <div className="catalog-per" role="group" aria-label={cc.perPage}>
      <span aria-hidden="true">{cc.perPage}:</span>
      {perPageOptions.map((option) => <button type="button" key={option} aria-pressed={option === per} onClick={() => onPer(option)}>{option}</button>)}
    </div>}
  </nav>;
}
