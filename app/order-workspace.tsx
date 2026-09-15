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
  CreditCard,
  Mail,
  MessageSquareText,
  Truck,
  UserCheck,
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
  orderPayable,
  type Pricing,
  type State,
  type Order,
  type Communication,
} from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import { localizedStatuses } from "@/lib/market/i18n";
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
const pendingChange = (o: Order) => (o.changeRequests ?? []).some((request) => request.status === "pending");
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

function OperatorOrderTools({
  order,
  run,
}: {
  order: Order;
  run: (action: Action) => Promise<boolean>;
}) {
  const [team, setTeam] = useState<"Закупки" | "Склад" | "Поддержка" | "Финансы">(order.assignment?.team ?? "Закупки");
  const [priority, setPriority] = useState<"Обычный" | "Высокий" | "Срочный">(order.assignment?.priority ?? "Обычный");
  const [carrier, setCarrier] = useState(order.parcel?.carrier ?? "Atlas Cargo");
  const [tracking, setTracking] = useState(order.parcel?.trackingNumber ?? "");
  const [warehouseCode, setWarehouseCode] = useState(order.parcel?.warehouseCode ?? "WH-TAS-01");
  const [note, setNote] = useState("");
  const [condition, setCondition] = useState<"ok" | "damaged" | "mismatch">(order.warehouseInspection?.condition ?? "ok");
  const [received, setReceived] = useState(String(order.warehouseInspection?.quantityReceived ?? order.quantity));
  const [warehouseNotes, setWarehouseNotes] = useState(order.warehouseInspection?.notes ?? "");
  const [packageGroup, setPackageGroup] = useState(order.warehouseInspection?.packageGroup ?? "");
  const [services, setServices] = useState<Array<"photo" | "repack" | "consolidate" | "split" | "fragile">>(order.warehouseInspection?.services ?? []);
  const [changeKind, setChangeKind] = useState<"price" | "variant" | "substitution" | "source-shipping" | "warehouse-service" | "customs">("variant");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [amountDelta, setAmountDelta] = useState("0");
  const [busy, setBusy] = useState(false);
  const save = async (action: Action, message: string) => {
    if (busy) return false;
    setBusy(true);
    const ok = await run(action);
    setBusy(false);
    if (ok) toast.success(message);
    return ok;
  };
  return (
    <details className="ops-tools">
      <summary><UserCheck size={17} /> Команда, трекинг и заметки</summary>
      <div className="ops-tools-grid">
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "assign-order", id: order.id, team, priority }, "Ответственный и приоритет сохранены"); }}>
          <h3>Ответственный</h3>
          <div className="two-fields">
            <div className="field"><label htmlFor={`team-${order.id}`}>Команда</label><select id={`team-${order.id}`} value={team} onChange={(event) => setTeam(event.target.value as typeof team)}>{["Закупки", "Склад", "Поддержка", "Финансы"].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="field"><label htmlFor={`priority-${order.id}`}>Приоритет</label><select id={`priority-${order.id}`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{["Обычный", "Высокий", "Срочный"].map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          <button className="btn secondary" disabled={busy}>Сохранить назначение</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "parcel-set", id: order.id, carrier, trackingNumber: tracking, warehouseCode }, "Трек-номер сохранён"); }}>
          <h3>Посылка</h3>
          <div className="field"><label htmlFor={`carrier-${order.id}`}>Перевозчик</label><input id={`carrier-${order.id}`} required minLength={2} maxLength={80} value={carrier} onChange={(event) => setCarrier(event.target.value)} /></div>
          <div className="two-fields">
            <div className="field"><label htmlFor={`tracking-${order.id}`}>Трек-номер</label><input id={`tracking-${order.id}`} required minLength={3} maxLength={100} placeholder="ATLAS-DEMO-001" value={tracking} onChange={(event) => setTracking(event.target.value)} /></div>
            <div className="field"><label htmlFor={`warehouse-${order.id}`}>Код склада</label><input id={`warehouse-${order.id}`} maxLength={80} value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)} /></div>
          </div>
          <button className="btn secondary" disabled={busy || order.status < 1}>Сохранить трекинг</button>
          {order.status < 1 && <p className="micro">Станет доступно после подтверждения выкупа.</p>}
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "staff-note", id: order.id, text: note }, "Внутренняя заметка добавлена").then(() => setNote("")); }}>
          <h3>Внутренняя заметка</h3>
          <div className="field"><label htmlFor={`note-${order.id}`}>Видна только оператору</label><textarea id={`note-${order.id}`} required minLength={1} maxLength={500} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></div>
          <button className="btn secondary" disabled={busy || !note.trim()}>Добавить заметку</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "warehouse-inspect", id: order.id, condition, quantityReceived: Number(received), notes: warehouseNotes, services, packageGroup }, "Приёмка на складе сохранена"); }}>
          <h3>Приёмка на складе</h3>
          <div className="two-fields"><div className="field"><label htmlFor={`condition-${order.id}`}>Состояние</label><select id={`condition-${order.id}`} value={condition} onChange={(event)=>setCondition(event.target.value as typeof condition)}><option value="ok">В порядке</option><option value="damaged">Повреждение</option><option value="mismatch">Не совпадает с заказом</option></select></div><div className="field"><label htmlFor={`received-${order.id}`}>Получено, шт.</label><input id={`received-${order.id}`} type="number" min="0" max="100" required value={received} onChange={(event)=>setReceived(event.target.value)}/></div></div>
          <div className="field"><label htmlFor={`group-${order.id}`}>Группа посылки</label><input id={`group-${order.id}`} maxLength={80} placeholder="Например, BOX-24" value={packageGroup} onChange={(event)=>setPackageGroup(event.target.value)}/></div>
          <fieldset className="service-options"><legend>Операции</legend>{[["photo","Фото"],["repack","Переупаковка"],["consolidate","Объединение"],["split","Разделение"],["fragile","Хрупкий груз"]].map(([value,label])=><label key={value}><input type="checkbox" checked={services.includes(value as typeof services[number])} onChange={(event)=>setServices(event.target.checked?[...new Set([...services,value as typeof services[number]])]:services.filter(item=>item!==value))}/>{label}</label>)}</fieldset>
          <div className="field"><label htmlFor={`warehouse-note-${order.id}`}>Комментарий приёмки</label><textarea id={`warehouse-note-${order.id}`} rows={3} maxLength={500} value={warehouseNotes} onChange={(event)=>setWarehouseNotes(event.target.value)}/></div>
          <button className="btn secondary" disabled={busy || order.status !== 2}>Сохранить приёмку</button>
          {order.status !== 2 && <p className="micro">Доступно, когда заказ прибыл на зарубежный склад.</p>}
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "change-request-create", id: order.id, kind: changeKind, title: changeTitle, reason: changeReason, previousValue: previousValue || undefined, proposedValue: proposedValue || undefined, amountDelta: Math.round(Number(amountDelta)) }, "Запрос отправлен покупателю").then((ok)=>{if(ok){setChangeTitle("");setChangeReason("");setPreviousValue("");setProposedValue("");setAmountDelta("0")}}); }}>
          <h3>Согласовать изменение</h3>
          <div className="field"><label htmlFor={`change-kind-${order.id}`}>Тип</label><select id={`change-kind-${order.id}`} value={changeKind} onChange={(event)=>setChangeKind(event.target.value as typeof changeKind)}><option value="price">Цена</option><option value="variant">Вариант</option><option value="substitution">Замена товара</option><option value="source-shipping">Доставка магазина</option><option value="warehouse-service">Услуга склада</option><option value="customs">Таможенные данные</option></select></div>
          <div className="field"><label htmlFor={`change-title-${order.id}`}>Что изменилось</label><input id={`change-title-${order.id}`} required minLength={2} maxLength={120} value={changeTitle} onChange={(event)=>setChangeTitle(event.target.value)}/></div>
          <div className="two-fields"><div className="field"><label htmlFor={`previous-${order.id}`}>Было</label><input id={`previous-${order.id}`} maxLength={240} value={previousValue} onChange={(event)=>setPreviousValue(event.target.value)}/></div><div className="field"><label htmlFor={`proposed-${order.id}`}>Стало</label><input id={`proposed-${order.id}`} maxLength={240} value={proposedValue} onChange={(event)=>setProposedValue(event.target.value)}/></div></div>
          <div className="field"><label htmlFor={`change-amount-${order.id}`}>Изменение суммы, сум</label><input id={`change-amount-${order.id}`} type="number" min="-100000000" max="100000000" step="1" value={amountDelta} onChange={(event)=>setAmountDelta(event.target.value)}/></div>
          <div className="field"><label htmlFor={`change-reason-${order.id}`}>Причина</label><textarea id={`change-reason-${order.id}`} required minLength={2} maxLength={500} rows={3} value={changeReason} onChange={(event)=>setChangeReason(event.target.value)}/></div>
          <button className="btn secondary" disabled={busy || !changeTitle.trim() || !changeReason.trim() || pendingChange(order)}>Отправить на согласование</button>
          {pendingChange(order) && <p className="micro">Покупатель ещё не ответил на предыдущий запрос.</p>}
        </form>
      </div>
      {!!order.staffNotes?.length && <div className="staff-notes"><h3>Последние заметки</h3>{[...order.staffNotes].reverse().slice(0, 3).map((item) => <p key={item.id}><time>{new Date(item.at).toLocaleString("ru-RU")}</time>{item.text}</p>)}</div>}
    </details>
  );
}

type OrderDocument={id:string;order_id:string;kind:string;filename:string;content_type:string;size:number;created_at:number};
function OrderDocuments({orderId,accountId,operatorMode,locale}:{orderId:string;accountId?:string;operatorMode:boolean;locale:"ru"|"uz"|"en"}){
 const [documents,setDocuments]=useState<OrderDocument[]>([]),[busy,setBusy]=useState(false);
 const words={ru:{title:'Документы заказа',empty:'Документов пока нет',invoice:'Счёт',proof:'Подтверждение покупки',photo:'Фото со склада',report:'Акт склада',upload:'Добавить документ',open:'Скачать'},uz:{title:'Buyurtma hujjatlari',empty:'Hujjatlar hali yo‘q',invoice:'Hisob',proof:'Xarid tasdig‘i',photo:'Ombor fotosi',report:'Ombor dalolatnomasi',upload:'Hujjat qo‘shish',open:'Yuklab olish'},en:{title:'Order documents',empty:'No documents yet',invoice:'Invoice',proof:'Purchase proof',photo:'Warehouse photo',report:'Warehouse report',upload:'Add document',open:'Download'}}[locale];
 const load=useCallback(async()=>{const response=await fetch(`/api/order-documents${operatorMode&&accountId?`?accountId=${encodeURIComponent(accountId)}`:''}`,{cache:'no-store'});const data=await response.json() as {documents?:OrderDocument[]};if(response.ok)setDocuments((data.documents??[]).filter(item=>item.order_id===orderId))},[accountId,operatorMode,orderId]);
 useEffect(()=>{queueMicrotask(()=>void load())},[load]);
 async function upload(form:HTMLFormElement){const body=new FormData(form);body.set('orderId',orderId);body.set('customerId',accountId??'');setBusy(true);try{const response=await fetch('/api/order-documents',{method:'POST',body});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error??'Upload failed');form.reset();await load();toast.success(words.upload)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 const labels:Record<string,string>={invoice:words.invoice,'purchase-proof':words.proof,'warehouse-photo':words.photo,'warehouse-report':words.report};
 return <details className="order-documents"><summary>{words.title}<span>{documents.length}</span></summary><div className="document-list">{documents.length?documents.map(item=><a key={item.id} href={`/api/order-documents?id=${encodeURIComponent(item.id)}`}><span><b>{labels[item.kind]??item.kind}</b><small>{item.filename}</small></span><strong>{words.open}</strong></a>):<p className="micro">{words.empty}</p>}</div>{operatorMode&&accountId&&<form className="document-upload" onSubmit={event=>{event.preventDefault();void upload(event.currentTarget)}}><select name="kind" aria-label="Тип документа"><option value="invoice">{words.invoice}</option><option value="purchase-proof">{words.proof}</option><option value="warehouse-photo">{words.photo}</option><option value="warehouse-report">{words.report}</option></select><input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required/><button className="btn secondary" disabled={busy}>{busy?'…':words.upload}</button></form>}</details>
}
export function OrdersView({ operations }: { operations: boolean }) {
  const { state, pricing, ready, error, act, user, refresh } = useMarket();
  const [expanded,setExpanded]=useState<string[]>([]);
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
      payment?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [opsAccounts, setOpsAccounts] = useState<OperationsAccount[]>([]),
    [opsPricing, setOpsPricing] = useState<Pricing>(pricing),
    [opsReady, setOpsReady] = useState(false),
    [opsError, setOpsError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const reveal = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const row = document.getElementById(id);
      if (row instanceof HTMLDetailsElement) { row.open = true; row.scrollIntoView({block:'start'}); }
      else { const order=state.orders.find(item=>item.id===id);if(order)queueMicrotask(()=>{setQuery('');setTab(order.cancelled||order.status===5?'done':'active')}); }
    };
    reveal(); window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [ready, tab, query, opsReady,state.orders]);
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
  const displayStatuses = localizedStatuses(state.communication.language);
  const wc={ru:{customerOver:"ВАШИ ПОКУПКИ В ПУТИ",customerTitle:"От магазина до вашей двери.",customerIntro:"Статусы, расчёты и история каждого заказа.",operatorOver:"РАБОЧЕЕ МЕСТО ОПЕРАТОРА",operatorTitle:"Всё готово к следующему шагу.",operatorIntro:"Выкупайте, принимайте на склад и согласовывайте исключения.",customerView:"Вид покупателя",operatorView:"Открыть обработку",active:"В работе",attention:"Нужно решение",done:"Завершённые",searchCustomer:"Номер или товар",searchOperator:"Номер, товар или покупатель"},uz:{customerOver:"BUYURTMALARINGIZ YO‘LDA",customerTitle:"Do‘kondan eshigingizgacha.",customerIntro:"Har bir buyurtmaning holati, hisobi va tarixi.",operatorOver:"OPERATOR ISH JOYI",operatorTitle:"Keyingi qadam uchun hammasi tayyor.",operatorIntro:"Xaridni, ombor qabulini va istisnolarni boshqaring.",customerView:"Mijoz ko‘rinishi",operatorView:"Qayta ishlashni ochish",active:"Jarayonda",attention:"Qaror kerak",done:"Yakunlangan",searchCustomer:"Raqam yoki tovar",searchOperator:"Raqam, tovar yoki mijoz"},en:{customerOver:"YOUR PURCHASES IN TRANSIT",customerTitle:"From the store to your door.",customerIntro:"Status, calculation and history for every order.",operatorOver:"OPERATOR WORKSPACE",operatorTitle:"Everything is ready for the next step.",operatorIntro:"Manage purchase, warehouse intake and exceptions.",customerView:"Customer view",operatorView:"Open processing",active:"In progress",attention:"Decision needed",done:"Completed",searchCustomer:"Order number or item",searchOperator:"Order number, item or customer"}}[state.communication.language];
  const receiving = orders.find((o) => o.id === warehouse);
  const confirmingStoreShipping = orders.find(
    (o) => o.id === storeShippingOrder,
  );
  const active = orders.filter((o) => !o.cancelled && o.status < 5),
    need = orders.filter((order) => !order.cancelled&&(isExtra(order) || pendingChange(order) || (!operations&&order.payment?.status==='pending') || order.warehouseInspection?.condition === "damaged" || order.warehouseInspection?.condition === "mismatch")),
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
          operations ? wc.operatorOver : wc.customerOver
        }
        title={
          operations
            ? wc.operatorTitle
            : wc.customerTitle
        }
        description={
          operations
            ? wc.operatorIntro
            : wc.customerIntro
        }
      >
        {(operations || user?.operator) && (
          <Link
            className="btn secondary"
            href={operations ? "/orders" : "/operations"}
          >
            {operations ? wc.customerView : wc.operatorView}
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
                {wc.active} <b>{active.length}</b>
              </TabsTrigger>
              <TabsTrigger value="attention">
                {wc.attention} <b>{need.length}</b>
              </TabsTrigger>
              <TabsTrigger value="done">
                {wc.done} <b>{done.length}</b>
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
              placeholder={operations ? wc.searchOperator : wc.searchCustomer}
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
          <details className="surface order-card compact-order" key={o.id} id={o.id} onToggle={event=>{const open=event.currentTarget.open;setExpanded(ids=>open?[...new Set([...ids,o.id])]:ids.filter(id=>id!==o.id))}}>
            <summary className="compact-order-summary">
              <ProductImage product={o.product} decorative />
              <span className="compact-order-name"><small>{o.id}{operations ? ` · ${orderAccount.get(o.id)?.name ?? ''}` : ''}</small><b>{o.product.name}</b><span>{o.variant} · {o.quantity}</span></span>
              <span className={'status-badge '+(isExtra(o)||pendingChange(o)||(!operations&&o.payment?.status==='pending')?'needs-action':'')}>{o.cancelled ? (state.communication.language==='ru'?'Отменён':state.communication.language==='uz'?'Bekor qilingan':'Cancelled') : isExtra(o)||pendingChange(o) ? wc.attention : o.payment?.status==='pending' ? (state.communication.language==='ru'?'Ожидает оплаты':state.communication.language==='uz'?'To‘lov kutilmoqda':'Awaiting payment') : displayStatuses[o.status]}</span>
              <strong>{money(orderPayable(o))}</strong><ArrowRight size={18}/>
            </summary>
            {expanded.includes(o.id)&&<div className="compact-order-body">
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
                  (isExtra(o) || pendingChange(o) ? "needs-action" : o.cancelled ? "cancelled" : "")
                }
              >
                {o.cancelled
                  ? "Отменён"
                  : pendingChange(o)
                    ? "Нужно решение"
                  : isExtra(o)
                    ? "Требуется доплата"
                    : displayStatuses[o.status]}
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
                <strong>{money(orderPayable(o))}</strong>
                <span>{orderPayable(o) === o.quote.total ? "Сумма при оформлении" : `При оформлении ${money(o.quote.total)}`}</span>
              </div>
            </div>
            {!o.cancelled && (
              <ol className="order-timeline">
                {displayStatuses.map((name, i) => (
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
            {o.payment && (
              <div className={"settlement-box payment-box " + (o.payment.status === "pending" ? "attention" : "")}>
                <CreditCard size={22} />
                <div>
                  <h3>{o.payment.status === "pending" ? "Ожидается тестовая оплата" : o.payment.status === "paid" ? "Тестовая оплата подтверждена" : "Тестовый платёж возвращён"}</h3>
                  <p>Платёж {o.payment.id} · {money(o.payment.amount)}.</p>
                  <strong>{o.payment.status === "pending" ? "Без реального списания" : "Сценарий платёжного провайдера пройден"}</strong>
                </div>
                {!operations && o.payment.status === "pending" && (
                  <button className="btn primary" onClick={() => setConfirmation({ id: o.id, cancel: false, amount: o.payment!.amount, payment: true })}>
                    Тестовая оплата <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}
            {o.delivery && (
              <div className="settlement-box delivery-box">
                <Package size={22} />
                <div><h3>Получатель: {o.delivery.recipient}</h3><p>{o.delivery.region}, {o.delivery.city}, {o.delivery.address}</p><strong>{o.delivery.phone}</strong></div>
              </div>
            )}
            {o.parcel && (
              <div className="settlement-box parcel-box">
                <Truck size={22} />
                <div><h3>{o.parcel.carrier}</h3><p>Трек-номер: {o.parcel.trackingNumber}{o.parcel.warehouseCode ? ` · склад ${o.parcel.warehouseCode}` : ""}</p><strong>{o.parcel.events.at(-1)?.status ?? "Посылка зарегистрирована"}</strong></div>
              </div>
            )}
            {o.warehouseInspection && (
              <div className={"settlement-box warehouse-box " + (o.warehouseInspection.condition === "ok" ? "" : "attention")}>
                <Package size={22}/><div><h3>{o.warehouseInspection.condition === "ok" ? "Приёмка на складе завершена" : "Склад зафиксировал проблему"}</h3><p>Получено: {o.warehouseInspection.quantityReceived} шт.{o.warehouseInspection.packageGroup ? ` · группа ${o.warehouseInspection.packageGroup}` : ""}</p><strong>{o.warehouseInspection.services.length ? `Операции: ${o.warehouseInspection.services.join(", ")}` : "Дополнительные операции не назначены"}</strong>{o.warehouseInspection.notes && <p>{o.warehouseInspection.notes}</p>}</div>
              </div>
            )}
            {!!o.changeRequests?.length && <section className="change-request-list" aria-label="Согласования по заказу">{[...o.changeRequests].reverse().map(request=><article className={`change-request ${request.status}`} key={request.id}><div><span className="eyebrow">{request.status === "pending" ? "НУЖНО РЕШЕНИЕ" : request.status === "approved" ? "ПОДТВЕРЖДЕНО" : "ОТКЛОНЕНО"}</span><h3>{request.title}</h3><p>{request.reason}</p>{(request.previousValue||request.proposedValue)&&<p className="change-values"><span>{request.previousValue||"—"}</span><ArrowRight size={15}/><b>{request.proposedValue||"—"}</b></p>}</div><div className="change-amount">{request.amountDelta !== 0 && <strong>{request.amountDelta > 0 ? "+" : ""}{money(request.amountDelta)}</strong>}{!operations && request.status === "pending" && <div className="change-actions"><button className="btn secondary" disabled={busy} onClick={()=>void runOrderAction({type:"change-request-respond",id:o.id,requestId:request.id,decision:"declined",expectedAmountDelta:request.amountDelta})}>Отклонить</button><button className="btn primary" disabled={busy} onClick={()=>void runOrderAction({type:"change-request-respond",id:o.id,requestId:request.id,decision:"approved",expectedAmountDelta:request.amountDelta})}>Подтвердить</button></div>}</div></article>)}</section>}
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
            {isExtra(o) && !operations && !pendingChange(o) && (
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
                disabled={isExtra(o) || pendingChange(o) || (o.status === 2 && !o.warehouseInspection) || (o.status === 0 && o.payment?.status === "pending") || (o.status === 3 && !o.parcel)}
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
            {operations && (isExtra(o) || pendingChange(o)) && (
              <p className="micro">
                Отправка станет доступна после подтверждения в разделе «Мои
                заказы».
              </p>
            )}
            {operations && o.status === 2 && !o.warehouseInspection && <p className="micro">Сначала сохраните приёмку товара в блоке оператора.</p>}
            {operations && o.status === 0 && o.payment?.status === "pending" && (
              <p className="micro">Выкуп станет доступен после тестового подтверждения оплаты клиентом.</p>
            )}
            {operations && o.status === 3 && !o.parcel && (
              <p className="micro">Перед отправкой добавьте перевозчика и трек-номер.</p>
            )}
            {operations && !o.cancelled && <OperatorOrderTools order={o} run={runOrderAction} />}
            <OrderDocuments orderId={o.id} accountId={orderAccount.get(o.id)?.id} operatorMode={operations} locale={state.communication.language}/>
            <div className="order-bottom">
              <details>
                <summary>Расчёт и история</summary>
                <div className="order-detail-grid">
                  <div>
                    <CostLines q={o.quote} locale={state.communication.language}/>
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
            </div>}
          </details>
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
              : confirmation?.payment
                ? "Подтвердить тестовую оплату?"
                : "Подтвердить тестовую доплату?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.cancel
              ? "Вся сумма вернётся на демобаланс. Заказ больше не поступит в обработку."
              : confirmation?.payment
                ? "Atlas имитирует успешный webhook платёжного провайдера. Деньги не списываются."
                : "После подтверждения оператор сможет отправить заказ. Реальных списаний не будет."}
          </AlertDialogDescription>
          <div className="confirm-price">
            <span>{confirmation?.cancel ? "К возврату" : confirmation?.payment ? "Тестовый платёж" : "К доплате"}</span>
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
                    : confirmation.payment
                      ? { type: "payment-demo", id: confirmation.id }
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
  const setNumber = (key: "fx" | "perKg" | "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "optionalServices" | "reserve" | "divisor", raw: string) =>
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
            buyoutFee: draft.buyoutFee,
            conversionFee: draft.conversionFee,
            deliveryMargin: draft.deliveryMargin,
            optionalServices: draft.optionalServices,
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
            ["buyoutFee", "Комиссия за выкуп", 0.01],
            ["conversionFee", "Комиссия за конвертацию", 0.01],
            ["deliveryMargin", "Маржа доставки", 0.01],
            ["optionalServices", "Доп. услуги, сум", 1],
            ["reserve", "Резерв доставки", 0.01],
            ["divisor", "Делитель объёмного веса", 1],
          ].map(([key, label, step]) => (
            <div className="field" key={String(key)}>
              <label htmlFor={`pricing-${key}`}>{label}{["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? ", %" : ""}</label>
              <input
                id={`pricing-${key}`}
                type="number"
                required
                min={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve", "optionalServices"].includes(String(key)) ? 0 : Number(step)}
                max={["margin", "buyoutFee", "conversionFee", "deliveryMargin"].includes(String(key)) ? 100 : key === "reserve" ? 200 : undefined}
                step={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? 0.1 : Number(step)}
                value={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? draft[key as "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "reserve"] * 100 : draft[key as "fx" | "perKg" | "optionalServices" | "divisor"]}
                onChange={(event) =>
                  setNumber(
                    key as "fx" | "perKg" | "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "optionalServices" | "reserve" | "divisor",
                    ["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? String(Number(event.target.value) / 100) : event.target.value,
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

function CommunicationPanel({
  value,
  email,
  phone,
  save,
}: {
  value: Communication;
  email: string;
  phone: string;
  save: (value: Communication) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Communication>({
    ...value,
    email: value.email || email,
    phone: value.phone || phone,
  });
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    const ok = await save(draft);
    setSaving(false);
    if (ok) toast.success("Настройки email и SMS сохранены");
  }
  return (
    <section className="surface communication-panel">
      <div className="communication-heading">
        <div><span className="eyebrow">КАНАЛЫ СВЯЗИ</span><h2>Email и SMS</h2><p>Предрелиз сохраняет настройки и формирует журнал сообщений, но ничего не отправляет наружу.</p></div>
        <span className="status-badge">Тестовый режим</span>
      </div>
      <div className="communication-grid">
        <label className="channel-card"><input type="checkbox" checked={draft.emailEnabled} onChange={(event) => setDraft({ ...draft, emailEnabled: event.target.checked })} /><Mail size={22} /><span><b>Email</b><small>Статусы, оплата и возвраты</small></span></label>
        <label className="channel-card"><input type="checkbox" checked={draft.smsEnabled} onChange={(event) => setDraft({ ...draft, smsEnabled: event.target.checked })} /><MessageSquareText size={22} /><span><b>SMS</b><small>Только важные изменения</small></span></label>
      </div>
      <div className="communication-fields">
        <div className="field"><label htmlFor="notice-email">Email</label><input id="notice-email" type="email" required={draft.emailEnabled} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div>
        <div className="field"><label htmlFor="notice-phone">Телефон</label><input id="notice-phone" type="tel" required={draft.smsEnabled} placeholder="+998 90 123 45 67" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div>
        <div className="field"><label htmlFor="notice-language">Язык интерфейса и уведомлений</label><select id="notice-language" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as "ru" | "uz" | "en" })}><option value="ru">Русский</option><option value="uz">O‘zbekcha</option><option value="en">English</option></select></div>
      </div>
      <button className="btn secondary" disabled={saving || (draft.emailEnabled && !draft.email) || (draft.smsEnabled && !draft.phone)} onClick={() => void submit()}>{saving ? "Сохраняем…" : "Сохранить настройки"}<Check size={17} /></button>
    </section>
  );
}

export function NotificationsView() {
  const { state, ready, error, act, user } = useMarket();
  const [noticeFilter,setNoticeFilter]=useState('all');
  const locale=state.communication.language;
  const noticeWords={ru:{all:'Все',unread:'Непрочитанные',orders:'Заказы',updates:'обновлений',history:'История обновлений',empty:'Таких уведомлений нет'},uz:{all:'Barchasi',unread:'O‘qilmagan',orders:'Buyurtmalar',updates:'yangilanish',history:'Yangilanishlar tarixi',empty:'Bunday bildirishnomalar yo‘q'},en:{all:'All',unread:'Unread',orders:'Orders',updates:'updates',history:'Update history',empty:'No matching notifications'}}[locale];
  const notices=state.notifications.filter(item=>noticeFilter==='all'||(noticeFilter==='unread'&&!item.read)||(noticeFilter==='orders'&&item.orderId));
  const grouped=new Map<string,typeof notices>();
  for(const item of [...notices].sort((a,b)=>b.at-a.at)){const key=item.orderId??item.id;grouped.set(key,[...(grouped.get(key)??[]),item]);}
  const groups=[...grouped.values()];
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
      {ready && <details className="ux-disclosure"><summary>{state.communication.language==='ru'?'Настройки email и SMS':state.communication.language==='uz'?'Email va SMS sozlamalari':'Email and SMS settings'}</summary><CommunicationPanel key={`${state.communication.emailEnabled}-${state.communication.smsEnabled}-${state.communication.email}-${state.communication.phone}-${state.communication.language}`} value={state.communication} email={user?.email ?? ""} phone={state.deliveryProfile?.phone ?? ""} save={(value) => act({ type: "communication-save", value })} /></details>}
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
        <><div className="notice-filters">{[['all',noticeWords.all],['unread',noticeWords.unread],['orders',noticeWords.orders]].map(([value,label])=><button key={value} className={noticeFilter===value?'active':''} aria-pressed={noticeFilter===value} onClick={()=>setNoticeFilter(value)}>{label}</button>)}</div>{!groups.length&&<p className="surface">{noticeWords.empty}</p>}<section className="surface notification-list">
          {groups.map(([item,...history]) => (
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
                {history.length>0&&<details className="notification-history"><summary>{history.length+1} {noticeWords.updates}</summary>{history.map(previous=><div key={previous.id}><b>{previous.title}</b><p>{previous.message}</p><time>{new Date(previous.at).toLocaleString(locale)}</time></div>)}</details>}
                {item.orderId && (
                  <Link className="text-link" href={'/orders#'+item.orderId}>
                    Открыть заказ {item.orderId}
                    <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section></>
      )}
      {ready && user?.operator && (
        <section className="message-log-section">
          <div className="section-heading"><h2>Журнал внешних сообщений</h2><span>{state.messageDeliveries.length} подготовлено</span></div>
          {!state.messageDeliveries.length ? <div className="surface message-log-empty"><Mail size={23} /><div><h3>Сообщений пока нет</h3><p>Включите канал и измените тестовый статус заказа — Atlas подготовит email или SMS.</p></div></div> : <div className="surface message-log">{state.messageDeliveries.map((item) => <article key={item.id}><span className="message-channel">{item.channel === "email" ? <Mail size={17} /> : <MessageSquareText size={17} />}{item.channel.toUpperCase()}</span><div><b>{item.title}</b><p>{item.orderId ? `${item.orderId} · ` : ""}{item.destination}</p></div><span className="status-badge">Предпросмотр</span><time>{new Date(item.at).toLocaleString("ru-RU")}</time></article>)}</div>}
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
