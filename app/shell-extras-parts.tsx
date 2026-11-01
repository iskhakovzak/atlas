'use client';
import {StorageNotice} from './storage-notice';
import {PerformanceProbe} from './performance-probe';
import {ImpactTracking} from './impact-tracking';
import {useCookieChoice} from './use-cookie-choice';
import {cookieAllowed} from '@/lib/market/cookie-consent';

/** Loaded by app/shell-extras.tsx right after hydration; same order as they had in the layout. One consent read feeds all three. */
export function ShellExtrasParts(){
  const {choice,known}=useCookieChoice();
  return <><StorageNotice choice={choice} known={known}/><PerformanceProbe analytics={known&&cookieAllowed(choice,'analytics')}/><ImpactTracking choice={choice} known={known}/></>;
}
