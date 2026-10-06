# Контракт API бухгалтерии (`/api/finance`)

Ветка `feat/ui-delivery-sprint`, 6.10.2026. Источник истины — `lib/market/finance.ts` (чистая модель), `lib/market/finance-auto.ts` (автопроводки, сверка, денежная позиция, налоговый календарь, выписка, счёт-расчёт), `lib/market/finance-server.ts` (D1), `app/api/finance/route.ts`. Все суммы — целые сумы (`amountUzs`). Оплата, выкуп и доставка в Atlas **симулируются**: статусы оплаты — отметки в Atlas, а не подтверждение банка; формулировки в UI не должны говорить «деньги получены/списаны».

## Права
- `GET` — `finance.read`. `POST` — `finance.write` + same-origin (`Origin` = origin сайта).
- Только администратор (`ATLAS_OPERATOR_EMAIL`): `unlock`, `bank-import`, `bank-confirm`. Остальным — 403 `err_50` / «Доступно только администратору.».
- Все мутации пишутся в `market_audit_events` (`ledger.add`, `ledger.void`, `ledger.replace`, `ledger.auto`, `ledger.bank-import`, `accounting.settings`, `accounting.lock`, `accounting.unlock`).

## Виды записей (`kinds` в ответе `GET ?month=`)
`ledgerKinds` из `finance.ts`: `kind → { direction: "in"|"out", group: "transit"|"expense"|"income"|"tax", ru, uz, en }`. Новые виды:
- `balance_payment` — in, transit, «Оплата с внутреннего баланса» (клиент оплатил заказ балансом; внутреннее движение, не приход денег).
- `balance_refund` — out, transit, «Возврат на внутренний баланс» (остаток взвешивания, разница доставки магазина, остаток пошлины, отмена заказа).

## Автозаписи
Идентификатор `AUTO-<orderId>-<kind>[-<n>]`, `createdBy: "system:auto"`. Сервер создаёт их при каждой записи операционной проекции (хук в `syncOperationalProjection`) и аннулирует те, условие которых перестало выполняться (`voidReason` начинается с `auto:`). Ручные записи (`LED-…`, `BANK-…`) сервер никогда не трогает. Признак для UI: `entrySource(id)` из `finance.ts` (`auto` | `bank` | `manual`) или `isAutoEntry(entry)` из `finance-auto.ts` — показывать бейдж «авто»/«выписка». Автозапись, аннулированную оператором вручную (причина не начинается с `auto:`), сервер заново **не** создаёт — она попадает в `reconcile` как `auto-voided-manually`; «Исправить» у автозаписи лучше скрыть (исправление даст ручную копию, а исходную сервер уже не тронет).

| kind | когда | сумма | дата |
|---|---|---|---|
| `customer_payment` | `payment.status === "paid"` (или `refunded`, если раньше была отметка оплаты — по `state.entries` `demo-payment:<id>`), `amount > 0`; у отменённого после оплаты заказа запись остаётся, её уравновешивает `balance_refund-cancel` | `payment.amount` | день отметки оплаты |
| `balance_payment` | `balanceUsed > 0` | `balanceUsed` | день `createdAt` |
| `goods_purchase` | `status ≥ 1` («Выкуплен»), не отменён | `orderFinance.goods` (товар без курсовой наценки + одобренные изменения цены) | день события «Выкуплен» в истории |
| `store_shipping` | `storeShippingSettlement.actual > 0` (при доплате — только после согласия клиента, иначе `estimated`) | `actual` | день события в истории |
| `customs_paid` | есть `customsSettlement` | `actual` (при неподтверждённой доплате — `estimated`) | `customsSettlement.at` |
| `balance_refund-settlement` | `settlement.refund > 0` | `refund` | день события «Взвешивание завершено» |
| `balance_refund-store-shipping` | `storeShippingSettlement.refund > 0` | `refund` | день события |
| `balance_refund-customs` | `customsSettlement.refund > 0` | `refund` | `customsSettlement.at` |
| `balance_refund-cancel` | заказ отменён | то, что было у Atlas: `payment.amount` (если была отметка оплаты) + `balanceUsed` | день события «Заказ отменён» |

Не автоматизируется: расход перевозчика (`carrier`), комиссии платёжной системы и банка, прочие расходы — вводятся вручную. `customs_help_fee` автозаписью **не** создаётся: комиссия за помощь с таможней уже входит в доход заказа (`services` в `market_order_finance`), запись в журнале удвоила бы доход.

Закрытый период: автозапись, дата которой попадает в закрытый месяц, не создаётся и не аннулируется, а попадает в список расхождений (`market_settings` key `accounting.auto-skipped`) и показывается в `reconcile`.

## GET

### `GET /api/finance?month=YYYY-MM`
Ответ (как раньше + новые поля):
```ts
{
  month: string;
  summary: MonthSummary;              // finance.ts
  entries: LedgerEntry[];             // журнал месяца (до 5000), новые первыми, включая автозаписи и аннулированные
  orders: OrderFinance[];             // заказы месяца
  orderEntries: LedgerEntry[];        // записи, привязанные к этим заказам (любой даты)
  stages: Record<string, string>;     // orderId → "0".."5" | "cancelled"
  obligations: Obligations;
  settings: AccountingSettings;       // profitTaxRate, lockedThrough?, fxRates?
  kinds: typeof ledgerKinds;
  locked: boolean;
  fx: { usd: number; cbuRate?: number; markup: number; source: "cbu"|"manual"; updatedAt?: number; rates: Record<string, number> };
      // usd — действующий курс тарифа (ЦБ × наценка); rates = settings.fxRates + USD (для формы записи)
  cash: CashPosition;                 // см. ниже (накопительно с начала года по выбранный месяц)
  reconcile?: ReconcileReport;        // только при &check=1
}
```

### `GET /api/finance?month=YYYY-MM&check=1`
То же, плюс `reconcile`:
```ts
type ReconcileCheck = { id: string; severity: "ok"|"info"|"warn"|"error"; title: string; detail: string; orderIds?: string[]; amount?: number; count?: number };
type ReconcileReport = { month: string; checkedAt: number; ok: boolean; errors: number; warnings: number; checks: ReconcileCheck[] };
```
Проверки (`id`): `payments-match` (оплаты по заказам = к оплате), `goods-within-order` (оплата магазину ≤ товар по заказу), `paid-not-bought` (оплачены, но не выкуплены дольше 7 дней), `unknown-order` (записи с несуществующим номером заказа), `carrier-unlinked` (расход перевозчика без заказа), `income-vs-auto` (доход месяца и автозаписи), `negative-profit`, `unclosed-months` (незакрытые месяцы старше 2), `auto-skipped` (автозаписи, не созданные из-за закрытого периода), `auto-voided-manually` (автозапись аннулирована вручную — будет создана заново).

### `GET /api/finance?year=YYYY`
```ts
{ year: number; summary: YearSummary; settings: AccountingSettings; taxCalendar: TaxCalendar; cash: CashPosition }
type TaxQuarter = { quarter: 1|2|3|4; label: string; months: string[]; periodEnd: string; deadline: string /* YYYY-MM-DD, ориентир */; tax: number; accruedToDate: number; paidToDate: number; due: number; status: "upcoming"|"current"|"due"|"paid"|"overdue"|"none" /* none — налога нет и долга нет */ };
// Сроки-ориентир: 20-е число месяца после квартала, за IV квартал — 1 марта следующего года. paidToDate — `tax_paid` с 1 января по срок; due = max(0, accruedToDate − paidToDate).
type TaxCalendar = { year: number; taxRate: number; note: string /* «ориентир, сверьте с бухгалтером» */; quarters: TaxQuarter[] };
```

### Денежная позиция
```ts
type CashPosition = {
  month: string; yearStart: string;
  receivable: { count: number; amount: number };        // «должны нам»: заказы ожидают оплаты
  owedToStores: { count: number; goods: number; storeShipping: number; total: number }; // «мы должны магазинам»: оплачено, не выкуплено
  customerBalances: { count: number; amount: number };  // внутренние балансы клиентов (обязательство Atlas)
  tax: { accrued: number; paid: number; due: number };  // с начала года: начислено − уплачено (tax_paid)
  ytd: { income: number; expenses: number; profit: number; net: number; orders: number };
  note: string;                                         // напоминание: платежи симулируются
};
```

### `GET /api/finance?invoice=AT-…`
Счёт-расчёт по заказу как данные для печати. Ответ — обёртка `{ invoice: InvoiceData }` (так возвращает `app/api/finance/route.ts`; `normalizeInvoice` в `app/accounting-helpers.ts` принимает и голый объект):
```ts
type InvoiceData = {
  number: string;            // = orderId
  issuedAt: number; createdAt: number; paidAt?: number;
  status: "pending"|"paid"|"refunded"|"cancelled"; statusRu: string;
  customer: { id: string; name?: string; email?: string; phone?: string };
  lines: { kind: string; label: string; amount: number }[];   // строки котировки (нулевые пропущены) + одобренные изменения
  goods: number; services: number; delivery: number; total: number;  // total = к оплате
  split: { transit: number; atlasIncome: number };                    // справочно
  disclaimer: string;        // «Не фискальный документ. Оплата, выкуп и доставка в Atlas симулируются…»
};
```
404, если заказа нет в `market_order_finance`.

### Выгрузки (CSV: `;`, UTF-8 BOM)
- Прежние: `?export=summary|orders|ledger|margins&from=&to=`, `?export=year&year=`.
- `?export=book&month=YYYY-MM` — «Полная книга месяца»: секция записей журнала (все, включая авто и аннулированные, колонка «Источник» = авто/вручную/выписка) и секция строк заказов.
- `?export=backup&from=YYYY-MM&to=YYYY-MM` — JSON-бэкап: `{ version: 1, exportedAt, from, to, settings, orders: OrderFinance[], entries: LedgerEntry[], summaries: MonthSummary[] }` (Content-Disposition attachment).

## POST (`Content-Type: application/json`)
Прежние: `entry`, `void`, `replace`, `settings`, `lock`, `unlock`.

- `{ kind: "bank-import", csv: string }` (admin, ≤ 1 МБ). Разбор выписки: строки `дата;сумма;назначение` (разделитель `;`, `,` или таб; первая строка-заголовок пропускается; дата `ГГГГ-ММ-ДД` или `ДД.ММ.ГГГГ`; сумма с запятой или точкой, пробелы-разделители тысяч допустимы). В назначении ищется номер `AT-` + 8–12 hex-символов (регистр любой). Ничего не записывается. Ответ:
```ts
{ lines: number; errors: { row: number; reason: string }[]; proposals: BankProposal[] }
type BankProposal = {
  row: number; date: string; amount: number; purpose: string;
  orderId?: string; found: boolean; status?: OrderFinance["status"]; payable?: number;
  alreadyRecorded: boolean;        // по заказу уже есть живая запись customer_payment (авто или ручная)
  action: "propose"|"skip";
  reason: string;                  // почему пропущено / что предлагается
  entry?: LedgerEntryInput;        // kind customer_payment, note «Выписка банка: …»
};
```
- `{ kind: "bank-confirm", entries: LedgerEntryInput[] }` (admin, до 200, только `kind: "customer_payment"`; `orderId` обязателен). Создаёт записи `BANK-…`, аудит `ledger.bank-import`. Ответ `{ ids: string[] }`. Закрытый период — 409.

## Типы для импорта в UI
`import type { CashPosition, ReconcileReport, ReconcileCheck, TaxCalendar, TaxQuarter, InvoiceData, BankProposal } from "@/lib/market/finance-auto"` и `isAutoEntry` оттуда же; остальное — из `@/lib/market/finance`.
