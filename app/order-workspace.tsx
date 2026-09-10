"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/site-link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Package,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
  Bell,
  CheckCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useMarket } from "@/lib/market/store";
import {
  balanceOf,
  money,
  settle,
  statuses,
  type Pricing,
  type State,
  type Order,
} from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import {
  PageHeading,
  Empty,
  Modal,
  CostLines,
  ProductImage,
} from "./market-ui";
const storeShippingExtra = (o: Order) =>
  !o.storeShippingExtraApproved ? (o.storeShippingSettlement?.extra ?? 0) : 0;
const warehouseExtra = (o: Order) =>
  !o.extraApproved ? (o.settlement?.extra ?? 0) : 0;
const isExtra = (o: Order) =>
  !o.cancelled && Boolean(storeShippingExtra(o) || warehouseExtra(o));
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
type OperationsAccount = {
  id: string;
  name: string;
  state: State;
  revision: number;
  updatedAt: number;
};
export function OrdersView({ operations }: { operations: boolean }) {
  const { state, pricing, ready, error, act, user, refresh } = useMarket();
  const [tab, setTab] = useState("active"),
    [query, setQuery] = useState(""),
    [warehouse, setWarehouse] = useState<string | null>(null),
    [storeShippingOrder, setStoreShippingOrder] = useState<string | null>(null),
    [actualStoreShipping, setActualStoreShipping] = useState("10"),
    [dims, setDims] = useState(["1.8", "30", "20", "15"]),
    [confirmation, setConfirmation] = useState<{
      id: string;
      cancel: boolean;
      amount: number;
      storeShipping?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [opsAccounts, setOpsAccounts] = useState<OperationsAccount[]>([]),
    [opsPricing, setOpsPricing] = useState<Pricing>(pricing),
    [opsReady, setOpsReady] = useState(false),
    [opsError, setOpsError] = useState<string | null>(null);
  const refreshOperations = useCallback(async () => {
    if (!operations || !user?.operator) return;
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const data = (await response.json()) as {
        accounts?: OperationsAccount[];
        pricing?: Pricing;
        error?: string;
      };
      if (!response.ok || !data.accounts || !data.pricing)
        throw Error(data.error ?? "Не удалось загрузить очередь.");
      setOpsAccounts(data.accounts);
      setOpsPricing(data.pricing);
      setOpsError(null);
      setOpsReady(true);
    } catch (nextError) {
      setOpsError((nextError as Error).message);
      setOpsReady(false);
    }
  }, [operations, user?.operator]);
  useEffect(() => {
    queueMicrotask(() => void refreshOperations());
  }, [refreshOperations]);
  const orders = operations
    ? opsAccounts.flatMap((profile) => profile.state.orders)
    : state.orders;
  const orderAccount = new Map(
    opsAccounts.flatMap((profile) =>
      profile.state.orders.map((order) => [order.id, profile] as const),
    ),
  );
  const viewReady = operations ? opsReady : ready;
  const viewError = operations ? opsError : error;
  const receiving = orders.find((o) => o.id === warehouse);
  const confirmingStoreShipping = orders.find(
    (o) => o.id === storeShippingOrder,
  );
  const active = orders.filter((o) => !o.cancelled && o.status < 5),
    need = orders.filter(isExtra),
    done = orders.filter((o) => o.cancelled || o.status === 5);
  const filtered = (
    tab === "active" ? active : tab === "attention" ? need : done
  ).filter((o) =>
    `${o.id} ${o.product.name} ${orderAccount.get(o.id)?.name ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  let calc: ReturnType<typeof settle> | null = null;
  try {
    if (receiving)
      calc = settle(
        receiving.quote,
        ...(dims.map(Number) as [number, number, number, number]),
      );
  } catch {}
  async function runOrderAction(action: Action) {
    if (!operations) return act(action);
    const orderId = "id" in action ? action.id : "";
    const profile = orderAccount.get(orderId);
    if (!profile) {
      toast.error("Профиль покупателя не найден. Обновите очередь.");
      return false;
    }
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "action",
          accountId: profile.id,
          revision: profile.revision,
          action,
        }),
      });
      const data = (await response.json()) as {
        account?: OperationsAccount;
        error?: string;
      };
      if (data.account)
        setOpsAccounts((current) =>
          current.map((item) =>
            item.id === data.account!.id ? data.account! : item,
          ),
        );
      if (!response.ok) {
        toast.error(data.error ?? "Не удалось сохранить действие.");
        if (!data.account) await refreshOperations();
        return false;
      }
      return true;
    } catch {
      toast.error("Нет связи с сервером. Обновите очередь перед повтором.");
      await refreshOperations();
      return false;
    }
  }
  async function loadPhoto(o: Order) {
    if (!o.product.sourceUrl) return;
    setBusy(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: o.product.sourceUrl }),
      });
      const data = (await response.json()) as {
        image?: string;
        error?: string;
      };
      if (!response.ok || !data.image)
        throw Error(data.error ?? "На странице не найдено фото.");
      if (
        await runOrderAction({ type: "order-image", id: o.id, image: data.image })
      )
        toast.success("Фото заказа обновлено.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finishReceiving() {
    if (!receiving || busy) return;
    setBusy(true);
    const ok = await runOrderAction({
      type: "receive",
      id: receiving.id,
      dimensions: dims.map(Number) as [number, number, number, number],
    });
    setBusy(false);
    if (ok) {
      setWarehouse(null);
      toast.success("Взвешивание и перерасчёт сохранены");
    }
  }
  async function finishStoreShipping() {
    if (!confirmingStoreShipping || busy) return;
    setBusy(true);
    const ok = await runOrderAction({
      type: "confirm-store-shipping",
      id: confirmingStoreShipping.id,
      actualUsd: Number(actualStoreShipping),
    });
    setBusy(false);
    if (ok) {
      setStoreShippingOrder(null);
      toast.success("Доставка магазина подтверждена и пересчитана");
    }
  }
  if (operations && ready && !user?.operator)
    return (
      <Empty
        title="Доступ только оператору"
        description="В личном кабинете доступны ваши покупки и баланс."
        href="/orders"
        label="Мои заказы"
      />
    );
  return (
    <>
      <PageHeading
        overline={
          operations ? "РАБОЧЕЕ МЕСТО ОПЕРАТОРА" : "ВАШИ ПОКУПКИ В ПУТИ"
        }
        title={
          operations
            ? "Всё готово к следующему шагу."
            : "От магазина до вашей двери."
        }
        description={
          operations
            ? "Выкупайте, принимайте на склад и согласовывайте исключения."
            : "Статусы, расчёты и история каждого заказа."
        }
      >
        {(operations || user?.operator) && (
          <Link
            className="btn secondary"
            href={operations ? "/orders" : "/operations"}
          >
            {operations ? "Вид покупателя" : "Тестировать обработку"}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </PageHeading>
      {operations && viewReady && (
        <PricingManager
          key={opsPricing.version}
          value={opsPricing}
          onSaved={(next) => {
            setOpsPricing(next);
            void refresh();
          }}
        />
      )}
      {operations && (
        <div className="ops-stats">
          <div>
            <span>В работе</span>
            <strong>{active.length}</strong>
            <Package />
          </div>
          <div>
            <span>Требуют согласования</span>
            <strong>{need.length}</strong>
            <Clock3 />
          </div>
          <div>
            <span>Ожидают взвешивания</span>
            <strong>{active.filter((o) => o.status === 2).length}</strong>
            <Scale />
          </div>
        </div>
      )}
      {orders.length > 0 && (
        <div className="order-controls">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="order-tabs">
              <TabsTrigger value="active">
                В работе <b>{active.length}</b>
              </TabsTrigger>
              <TabsTrigger value="attention">
                Доплата <b>{need.length}</b>
              </TabsTrigger>
              <TabsTrigger value="done">
                Завершённые <b>{done.length}</b>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="sr-only">
              Фильтр заказов:{" "}
              {tab === "active"
                ? "В работе"
                : tab === "attention"
                  ? "Доплата"
                  : "Завершённые"}
            </TabsContent>
          </Tabs>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Поиск заказа"
              placeholder={operations ? "Номер, товар или покупатель" : "Номер или товар"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      )}
      {!viewReady ? (
        viewError ? (
          <Empty
            title={operations ? "Очередь пока недоступна" : "Войдите, чтобы открыть заказы"}
            description={operations ? viewError ?? "Повторите загрузку очереди." : "История покупок, фото и расчёты доступны в вашем профиле Atlas."}
            href={operations ? "/operations" : "/account"}
            label={operations ? "Повторить" : "Открыть вход"}
          />
        ) : (
          <div className="loading-state">Загружаем заказы…</div>
        )
      ) : !orders.length ? (
        <Empty
          title={operations ? "Очередь заказов пуста" : "Здесь начнётся путь вашей покупки"}
          description={operations ? "Новых клиентских заказов пока нет." : "Оформите заказ из корзины, чтобы попробовать выкуп, склад и доставку."}
          href="/"
          label="Выбрать товар"
        />
      ) : !filtered.length ? (
        <Empty
          title="В этом разделе пока пусто"
          description="Измените фильтр или поисковый запрос."
        />
      ) : (
        filtered.map((o) => (
          <article className="surface order-card" key={o.id}>
            <div className="order-card-head">
              <div>
                <b>{o.id}</b>
                <span>{new Date(o.createdAt).toLocaleDateString("ru-RU")}</span>
                {operations && orderAccount.get(o.id) && (
                  <span className="customer-badge">
                    Покупатель: {orderAccount.get(o.id)!.name}
                  </span>
                )}
              </div>
              <span
                className={
                  "status-badge " +
                  (isExtra(o) ? "needs-action" : o.cancelled ? "cancelled" : "")
                }
              >
                {o.cancelled
                  ? "Отменён"
                  : isExtra(o)
                    ? "Требуется доплата"
                    : statuses[o.status]}
              </span>
            </div>
            <div className="order-product">
              <div className="order-photo">
                <ProductImage product={o.product} decorative />
              </div>
              <div>
                <h2>{o.product.name}</h2>
                <p>
                  {o.variant} · {o.quantity} шт. · {o.product.country ?? "США"}
                </p>
                {o.product.sourceUrl && (
                  <a
                    className="text-link"
                    href={o.product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Источник товара
                    <ArrowUpRight size={14} />
                  </a>
                )}
                <span className="muted">{o.product.brand}</span>
                {o.product.sourceUrl && !o.product.image && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => loadPhoto(o)}
                  >
                    {busy ? "Загружаем…" : "Загрузить фото из ссылки"}
                  </button>
                )}
              </div>
              <div className="order-amount">
                <strong>{money(o.quote.total)}</strong>
                <span>Сумма при оформлении</span>
              </div>
            </div>
            {!o.cancelled && (
              <ol className="order-timeline">
                {statuses.map((name, i) => (
                  <li
                    key={name}
                    className={
                      i < o.status
                        ? "complete"
                        : i === o.status
                          ? "current"
                          : ""
                    }
                  >
                    <b>{i < o.status ? <Check size={14} /> : i + 1}</b>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>
            )}
            {!operations &&
              !o.cancelled &&
              o.status === 0 &&
              o.product.sourceShippingEstimated &&
              !o.storeShippingSettlement && (
                <div className="settlement-box">
                  <Clock3 size={22} />
                  <div>
                    <h3>Менеджер уточняет доставку магазина</h3>
                    <p>
                      В сумму заказа пока включён резерв{" "}
                      {money(o.quote.sourceShipping ?? 0)}. Перед выкупом вы
                      увидите подтверждённую стоимость.
                    </p>
                  </div>
                </div>
              )}
            {o.storeShippingSettlement && (
              <div
                className={
                  "settlement-box " +
                  (storeShippingExtra(o) ? "attention" : "")
                }
              >
                <Package size={22} />
                <div>
                  <h3>Менеджер подтвердил доставку магазина</h3>
                  <p>
                    Фактическая стоимость:{" "}
                    {usd(o.storeShippingSettlement.actualUsd)} ·{" "}
                    {money(o.storeShippingSettlement.actual)}.
                  </p>
                  <p>
                    Резерв при оформлении:{" "}
                    {money(o.storeShippingSettlement.estimated)}.
                  </p>
                  <strong>
                    {o.storeShippingSettlement.refund
                      ? "Вернули " +
                        money(o.storeShippingSettlement.refund) +
                        " на баланс"
                      : o.storeShippingExtraApproved
                        ? "Доплата подтверждена: " +
                          money(o.storeShippingSettlement.extra)
                        : o.storeShippingSettlement.extra
                          ? "Нужно согласовать " +
                            money(o.storeShippingSettlement.extra)
                          : "Сумма совпала с резервом"}
                  </strong>
                </div>
                {o.storeShippingSettlement.refund > 0 && (
                  <Link href="/balance" className="text-link">
                    Баланс
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            )}
            {o.settlement && (
              <div
                className={"settlement-box " + (isExtra(o) ? "attention" : "")}
              >
                <Scale size={22} />
                <div>
                  <h3>
                    {isExtra(o)
                      ? "Доставка превысила резерв"
                      : o.settlement.refund
                        ? "Доставка оказалась дешевле"
                        : "Доставка пересчитана"}
                  </h3>
                  <p>
                    Оплачиваемый вес: {o.settlement.chargeableWeight.toFixed(2)}{" "}
                    кг. Стоимость: {money(o.settlement.shipping)}.
                  </p>
                  <strong>
                    {o.settlement.refund
                      ? "Вернули " +
                        money(o.settlement.refund) +
                        " на демобаланс"
                      : o.extraApproved
                        ? "Доплата подтверждена: " + money(o.settlement.extra)
                        : o.settlement.extra
                          ? "Нужно согласовать " + money(o.settlement.extra)
                          : "Доплата не требуется"}
                  </strong>
                </div>
                {o.settlement.refund > 0 && (
                  <Link href="/balance" className="text-link">
                    Баланс
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            )}
            {isExtra(o) && !operations && (
              <button
                className="btn primary"
                onClick={() =>
                  setConfirmation({
                    id: o.id,
                    cancel: false,
                    amount: storeShippingExtra(o) || warehouseExtra(o),
                    storeShipping: Boolean(storeShippingExtra(o)),
                  })
                }
              >
                Проверить доплату
                <ArrowRight size={16} />
              </button>
            )}
            {operations &&
              !o.cancelled &&
              o.status === 0 &&
              o.product.sourceShippingEstimated &&
              !o.storeShippingSettlement && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setActualStoreShipping(
                      String(o.product.sourceShippingUsd ?? 10),
                    );
                    setStoreShippingOrder(o.id);
                  }}
                >
                  Подтвердить доставку магазина
                  <ArrowRight size={16} />
                </button>
              )}
            {operations &&
              !o.cancelled &&
              o.status < 5 &&
              !(
                o.status === 0 &&
                o.product.sourceShippingEstimated &&
                !o.storeShippingSettlement
              ) && (
              <button
                className="btn primary"
                disabled={isExtra(o)}
                onClick={async () => {
                  if (o.status === 2) {
                    setWarehouse(o.id);
                    setDims([
                      String(
                        Math.max(
                          0.1,
                          Math.round(o.quote.weight * 0.85 * 100) / 100,
                        ),
                      ),
                      "30",
                      "20",
                      "15",
                    ]);
                    return;
                  }
                  if (
                    await runOrderAction({
                      type: "advance",
                      id: o.id,
                      expected: o.status,
                    })
                  )
                    toast.success("Статус заказа обновлён");
                }}
              >
                {o.status === 0
                  ? "Подтвердить выкуп"
                  : o.status === 1
                    ? "Принять на склад"
                    : o.status === 2
                      ? "Взвесить и пересчитать"
                      : o.status === 3
                        ? "Отправить в Узбекистан"
                        : "Подтвердить доставку"}
                <ArrowRight size={16} />
              </button>
            )}
            {operations && isExtra(o) && (
              <p className="micro">
                Отправка станет доступна после подтверждения в разделе «Мои
                заказы».
              </p>
            )}
            <div className="order-bottom">
              <details>
                <summary>Расчёт и история</summary>
                <div className="order-detail-grid">
                  <div>
                    <CostLines q={o.quote} />
                    {o.customsConsent && (
                      <p className="micro">
                        Таможенные условия приняты:{" "}
                        {new Date(o.customsConsent.acceptedAt).toLocaleString(
                          "ru-RU",
                        )}
                        .
                      </p>
                    )}
                    {o.balanceUsed > 0 && (
                      <p className="micro">
                        При оформлении с демобаланса: {money(o.balanceUsed)}
                      </p>
                    )}
                    {o.settlement && (
                      <p className="micro">
                        Фактический вес: {o.settlement.actualWeight.toFixed(2)}{" "}
                        кг · Объёмный:{" "}
                        {o.settlement.dimensionalWeight.toFixed(2)} кг
                      </p>
                    )}
                  </div>
                  <ol className="history-list">
                    {[...o.history].reverse().map((h, i) => (
                      <li key={i}>
                        <time>{new Date(h.at).toLocaleString("ru-RU")}</time>
                        <p>{h.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
              {!operations && o.status === 0 && !o.cancelled && (
                <button
                  className="text-button"
                  onClick={() =>
                    setConfirmation({
                      id: o.id,
                      cancel: true,
                      amount: o.quote.total,
                    })
                  }
                >
                  Отменить заказ
                </button>
              )}
            </div>
          </article>
        ))
      )}
      <Modal
        open={!!confirmingStoreShipping}
        onClose={() => {
          if (!busy) setStoreShippingOrder(null);
        }}
        title="Доставка от магазина до склада"
        description="Укажите фактическую итоговую стоимость в долларах. Если она ниже резерва, разница сразу вернётся покупателю на баланс."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finishStoreShipping();
          }}
        >
          <div className="field">
            <label htmlFor="actual-store-shipping">
              Фактическая доставка магазина, USD
            </label>
            <input
              id="actual-store-shipping"
              type="number"
              inputMode="decimal"
              required
              min="0"
              max="10000"
              step=".01"
              value={actualStoreShipping}
              onChange={(e) => setActualStoreShipping(e.target.value)}
            />
          </div>
          {confirmingStoreShipping && (
            <div className="confirm-price">
              <span>Было заложено</span>
              <strong>
                {money(confirmingStoreShipping.quote.sourceShipping ?? 0)}
              </strong>
            </div>
          )}
          <button className="btn primary full" disabled={busy}>
            {busy ? "Сохраняем…" : "Подтвердить и пересчитать"}
            <Check size={18} />
          </button>
        </form>
      </Modal>
      <Modal
        open={!!receiving}
        onClose={() => {
          if (!busy) setWarehouse(null);
        }}
        title="Взвешивание на складе"
        description="Вес и размеры всей посылки, включая упаковку. Тариф зафиксирован в заказе."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finishReceiving();
          }}
        >
          <div className="two-fields">
            {[
              "Фактический вес, кг",
              "Длина, см",
              "Ширина, см",
              "Высота, см",
            ].map((l, i) => (
              <div className="field" key={l}>
                <label htmlFor={"dim-" + i}>{l}</label>
                <input
                  id={"dim-" + i}
                  type="number"
                  inputMode="decimal"
                  required
                  min=".01"
                  max={i ? 300 : 500}
                  step=".01"
                  value={dims[i]}
                  onChange={(e) =>
                    setDims(dims.map((n, j) => (j === i ? e.target.value : n)))
                  }
                />
              </div>
            ))}
          </div>
          {calc && receiving ? (
            <div className="receiving-preview">
              <dl className="cost-lines">
                <div>
                  <dt>Объёмный вес</dt>
                  <dd>{calc.dimensionalWeight.toFixed(2)} кг</dd>
                </div>
                <div>
                  <dt>Оплачиваемый вес</dt>
                  <dd>{calc.chargeableWeight.toFixed(2)} кг</dd>
                </div>
                <div>
                  <dt>Было оплачено за доставку</dt>
                  <dd>
                    {money(receiving.quote.shipping + receiving.quote.reserve)}
                  </dd>
                </div>
                <div>
                  <dt>После взвешивания</dt>
                  <dd>{money(calc.shipping)}</dd>
                </div>
              </dl>
              <div
                className={"result-line " + (calc.extra ? "warning-text" : "")}
              >
                <span>
                  {calc.extra ? "Запросить доплату" : "Вернуть на демобаланс"}
                </span>
                <strong>{money(calc.extra || calc.refund)}</strong>
              </div>
            </div>
          ) : (
            <p role="alert" className="warning-text">
              Укажите корректные положительные значения.
            </p>
          )}
          <button className="btn primary full" disabled={!calc || busy}>
            {busy ? "Сохраняем…" : "Подтвердить перерасчёт"}
            <Check size={18} />
          </button>
        </form>
      </Modal>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(v) => {
          if (!v && !busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmation?.cancel
              ? "Отменить заказ до выкупа?"
              : "Подтвердить тестовую доплату?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.cancel
              ? "Вся сумма вернётся на демобаланс. Заказ больше не поступит в обработку."
              : "После подтверждения оператор сможет отправить заказ. Реальных списаний не будет."}
          </AlertDialogDescription>
          <div className="confirm-price">
            <span>{confirmation?.cancel ? "К возврату" : "К доплате"}</span>
            <strong>{money(confirmation?.amount ?? 0)}</strong>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Назад</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmation || busy) return;
                setBusy(true);
                const ok = await act(
                  confirmation.cancel
                    ? { type: "cancel", id: confirmation.id }
                    : confirmation.storeShipping
                      ? {
                          type: "approve-store-shipping-extra",
                          id: confirmation.id,
                          amount: confirmation.amount,
                        }
                      : {
                        type: "approve-extra",
                        id: confirmation.id,
                        amount: confirmation.amount,
                        },
                );
                setBusy(false);
                if (ok) {
                  setConfirmation(null);
                  toast.success("Изменения сохранены");
                }
              }}
            >
              {busy
                ? "Сохраняем…"
                : confirmation?.cancel
                  ? "Отменить заказ"
                  : "Подтвердить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function PricingManager({
  value,
  onSaved,
}: {
  value: Pricing;
  onSaved: (next: Pricing) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const setNumber = (key: "fx" | "perKg" | "margin" | "reserve" | "divisor", raw: string) =>
    setDraft((current) => ({ ...current, [key]: Number(raw) }));
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pricing",
          value: {
            fx: draft.fx,
            perKg: draft.perKg,
            margin: draft.margin,
            reserve: draft.reserve,
            divisor: draft.divisor,
            rates: draft.rates,
          },
        }),
      });
      const data = (await response.json()) as { pricing?: Pricing; error?: string };
      if (!response.ok || !data.pricing)
        throw Error(data.error ?? "Не удалось сохранить тарифы.");
      onSaved(data.pricing);
      toast.success("Новые расчёты будут использовать обновлённые тарифы");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className="surface pricing-manager">
      <summary>
        <span>
          <b>Курсы и тарифы</b>
          <small>
            {money(value.fx)} / USD · обновлено{" "}
            {value.updatedAt
              ? new Date(value.updatedAt).toLocaleString("ru-RU")
              : "по умолчанию"}
          </small>
        </span>
        <span className="status-badge">{value.version}</span>
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="pricing-grid">
          {[
            ["fx", "Сум за 1 USD", 1],
            ["perKg", "Доставка за кг, сум", 1],
            ["margin", "Сервисный сбор", 0.01],
            ["reserve", "Резерв доставки", 0.01],
            ["divisor", "Делитель объёмного веса", 1],
          ].map(([key, label, step]) => (
            <div className="field" key={String(key)}>
              <label htmlFor={`pricing-${key}`}>{label}</label>
              <input
                id={`pricing-${key}`}
                type="number"
                required
                min={Number(step)}
                step={Number(step)}
                value={draft[key as "fx" | "perKg" | "margin" | "reserve" | "divisor"]}
                onChange={(event) =>
                  setNumber(
                    key as "fx" | "perKg" | "margin" | "reserve" | "divisor",
                    event.target.value,
                  )
                }
              />
            </div>
          ))}
        </div>
        <details className="currency-rates">
          <summary>Курсы валют к USD</summary>
          <div className="pricing-grid currency-grid">
            {Object.entries(draft.rates).map(([code, rate]) => (
              <div className="field" key={code}>
                <label htmlFor={`rate-${code}`}>1 {code} в USD</label>
                <input
                  id={`rate-${code}`}
                  type="number"
                  required
                  min="0.000001"
                  step="0.000001"
                  value={rate}
                  disabled={code === "USD"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rates: {
                        ...current.rates,
                        [code]: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </details>
        <p className="micro">
          Новые значения применяются только к новым и обновлённым расчётам.
          Уже оформленные заказы сохраняют исходную сумму.
        </p>
        <button className="btn primary" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить тарифы"}
          <Check size={17} />
        </button>
      </form>
    </details>
  );
}

export function NotificationsView() {
  const { state, ready, error, act } = useMarket();
  const unread = state.notifications.filter((item) => !item.read).length;
  return (
    <>
      <PageHeading
        overline="ВАЖНОЕ ПО ЗАКАЗАМ"
        title="Уведомления."
        description="Изменения статусов, возвраты и запросы на согласование в одном месте."
      >
        {unread > 0 && (
          <button
            className="btn secondary"
            onClick={() => void act({ type: "notifications-read" })}
          >
            <CheckCheck size={17} /> Прочитать все
          </button>
        )}
      </PageHeading>
      {!ready ? (
        error ? (
          <Empty
            title="Войдите, чтобы открыть уведомления"
            description="Сообщения Atlas доступны в вашем профиле."
            href="/account"
            label="Открыть вход"
          />
        ) : (
          <div className="loading-state">Загружаем уведомления…</div>
        )
      ) : !state.notifications.length ? (
        <Empty
          title="Пока всё спокойно"
          description="Здесь появятся изменения статусов и вопросы по вашим заказам."
          href="/orders"
          label="Мои заказы"
        />
      ) : (
        <section className="surface notification-list">
          {state.notifications.map((item) => (
            <article
              className={"notification-item " + (!item.read ? "unread" : "")}
              key={item.id}
            >
              <span className="notification-icon"><Bell size={18} /></span>
              <div>
                <div className="notification-title">
                  <h2>{item.title}</h2>
                  <time>{new Date(item.at).toLocaleString("ru-RU")}</time>
                </div>
                <p>{item.message}</p>
                {item.orderId && (
                  <Link className="text-link" href="/orders">
                    Открыть заказ {item.orderId}
                    <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

export function BalanceView() {
  const { state, ready, error } = useMarket();
  const reserved = state.orders
    .filter((o) => !o.cancelled && !o.settlement)
    .reduce((s, o) => s + o.quote.reserve, 0);
  return (
    <>
      <PageHeading
        overline="ДЕНЬГИ ПОД КОНТРОЛЕМ"
        title="Баланс с понятной историей."
        description="Возвраты и оплата следующих тестовых заказов."
      />
      <div className="balance-panels">
        <section className="balance-primary">
          <div>
            <Wallet size={24} />
            <span>Демобаланс</span>
          </div>
          <span>Доступно для покупок</span>
          <h2>{money(balanceOf(state))}</h2>
          <Link href="/" className="btn light">
            Выбрать товар
            <ArrowUpRight size={18} />
          </Link>
          <small>Тестовые средства без денежной стоимости</small>
        </section>
        <section className="surface reserve-panel">
          <ShieldCheck size={25} />
          <h2>Резерв доставки</h2>
          <strong>{money(reserved)}</strong>
          <p>
            Уже включён в сумму заказов. Остаток вернётся после взвешивания
            посылок.
          </p>
          <Link href="/orders" className="text-link">
            Посмотреть заказы
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="section-heading">
        <h2>История операций</h2>
        <span>{state.entries.length} операций</span>
      </div>
      {!ready ? (
        error ? (
          <Empty
            title="Войдите, чтобы открыть баланс"
            description="Возвраты и оплата следующих заказов сохраняются в вашем профиле."
            href="/account"
            label="Открыть вход"
          />
        ) : (
          <p>Загружаем операции…</p>
        )
      ) : !state.entries.length ? (
        <Empty
          title="История начнётся с первого возврата"
          description="После взвешивания остаток доставки автоматически появится здесь."
        />
      ) : (
        <div className="surface ledger-list">
          {[...state.entries].reverse().map((e) => {
            const positive = e.credit === "customer-credit";
            return (
              <div className="ledger-entry" key={e.id}>
                <span className={"ledger-icon " + (!positive ? "debit" : "")}>
                  <ArrowUpRight size={22} />
                </span>
                <div>
                  <h3>{e.description}</h3>
                  <p>
                    {e.orderId} · {new Date(e.at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <strong className={positive ? "credit" : ""}>
                  {positive ? "+" : "−"}
                  {money(e.amount)}
                </strong>
              </div>
            );
          })}
        </div>
      )}
      <div className="notice">
        <Wallet size={20} />
        <span>
          Демобаланс можно использовать в корзине. Пополнение и вывод реальных
          денег не подключены.
        </span>
      </div>
    </>
  );
}
