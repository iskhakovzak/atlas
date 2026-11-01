'use client';
import type { ReactNode } from 'react';
import { PageLangProvider } from '@/components/site-link';
import { useMarket } from '@/lib/market/store';
import type { Locale } from '@/lib/market/i18n';

/**
 * Hands SiteLink the language its links keep: on a page opened as `?lang=xx` (`requested`, from middleware) it is the
 * language on screen, so after a switch in the menu the links follow it; on an x-default address links stay bare.
 */
export function PageLang({ requested, children }: { requested: Locale | null; children: ReactNode }) {
  const { state } = useMarket();
  return <PageLangProvider value={requested ? state.communication.language as Locale : null}>{children}</PageLangProvider>;
}
