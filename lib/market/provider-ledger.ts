import {paidRecordsByDay, type BrightDataSettings, type ProviderDay} from '../importer/brightdata.ts';
import {isPeriodLocked, type AccountingSettings, type LedgerEntryInput} from './finance.ts';

/** Ledger ids of the daily Bright Data expense: one per Tashkent day, written once and never rewritten. */
export const brightDataLedgerPrefix = 'AUTO-BRIGHTDATA-';
export const brightDataCounterparty = 'Bright Data';

export type ProviderLedgerEntry = LedgerEntryInput & {id: string};
export type ProviderLedgerSkip = {day: string; reason: string};

/**
 * The expense entries for finished days: records over the month's free allowance × the price per 1000, in soum at
 * `usdRate`. Today is still running and is left for tomorrow; a closed period, an existing (even voided) entry and a
 * day without paid records are skipped. Topping up the Bright Data wallet is not an expense here — that would count
 * the same money twice.
 */
export function planBrightDataLedger(days: ProviderDay[], settings: Pick<BrightDataSettings, 'freeRecordsPerMonth' | 'pricePer1kUsd' | 'ledger'>, options: {today: string; usdRate: number; accounting: Pick<AccountingSettings, 'lockedThrough'>; existingIds: Set<string>; stores?: Record<string, Record<string, number>>}) {
  const insert: ProviderLedgerEntry[] = [], skipped: ProviderLedgerSkip[] = [];
  if (!settings.ledger) return {insert, skipped};
  for (const charge of paidRecordsByDay(days, settings.freeRecordsPerMonth, settings.pricePer1kUsd)) {
    if (charge.day >= options.today || charge.paidRecords <= 0 || charge.usd <= 0) continue;
    const id = brightDataLedgerPrefix + charge.day;
    if (options.existingIds.has(id)) continue;
    if (isPeriodLocked(options.accounting, charge.day)) { skipped.push({day: charge.day, reason: 'период закрыт'}); continue; }
    const amountUzs = Number.isFinite(options.usdRate) && options.usdRate > 0 ? Math.round(charge.usd * options.usdRate) : 0;
    if (amountUzs <= 0) { skipped.push({day: charge.day, reason: 'нет курса USD'}); continue; }
    const byStore = Object.entries(options.stores?.[charge.day] ?? {}).filter(([, count]) => count > 0).map(([store, count]) => `${store} ${count}`).join(', ');
    insert.push({
      id, kind: 'software', amountUzs, originalAmount: charge.usd, originalCurrency: 'USD', occurredOn: charge.day, counterparty: brightDataCounterparty,
      note: `Сбор данных Walmart: ${charge.records} записей за день${byStore ? ` (${byStore})` : ''}, платных ${charge.paidRecords} сверх ${settings.freeRecordsPerMonth} бесплатных в месяц, $${settings.pricePer1kUsd} за 1000.`.slice(0, 500),
    });
  }
  return {insert, skipped};
}
