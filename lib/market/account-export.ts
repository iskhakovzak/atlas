// «Скачать мои данные» (3 November 2026): everything Atlas keeps about the signed-in customer, as one JSON file.
// GET /api/account/export reads the rows; this module decides what goes in. Left out on purpose: session and code
// hashes, provider tokens, push keys (endpoint, p256dh, auth), storage keys of files, idempotency keys, the operators'
// own work notes and assignment (other people's data), and the full passport number and PINFL, which stay on the
// server for customs only (the account shows and exports their last digits, as everywhere else). No Cloudflare imports.
import { balanceOf, type State } from "./domain.ts";
import { buyerParcels } from "./parcels.ts";

export const ACCOUNT_EXPORT_FORMAT = "atlas-account-export/1";

export type ExportProfile = { userId: string; name: string; email: string; contact: string; method: string; createdAt: number };
export type ExportSignInMethod = { method: string; contact: string; createdAt?: number; own?: boolean };
export type ExportConsentRow = { document_key: string; document_version: string; accepted_at: number };
export type ExportPassportRow = { id: string; status: string; filename: string; created_at: number };
export type ExportOrderDocumentRow = { id: string; order_id: string; kind: string; filename: string; content_type: string; size: number; created_at: number };
export type ExportPromoRow = { code: string; order_ids: string; discount: number; created_at: number; returned_at: number | null };
export type ExportPushRow = { endpoint: string; created_at: number };

export type AccountExportInput = {
  profile: ExportProfile;
  state: State;
  signInMethods: ExportSignInMethod[];
  consents: ExportConsentRow[];
  passports: ExportPassportRow[];
  orderDocuments: ExportOrderDocumentRow[];
  promoUses: ExportPromoRow[];
  pushSubscriptions: ExportPushRow[];
  now: number;
};

/** Only the service that delivers browser notifications (e.g. "fcm.googleapis.com"), never the endpoint itself. */
function pushService(endpoint: string) {
  try { return new URL(endpoint).hostname; } catch { return "unknown"; }
}

function orderIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export function buildAccountExport(input: AccountExportInput) {
  const { profile, state, now } = input;
  // The account document as the customer's screens read it, minus the server's internal bookkeeping
  // (idempotency keys, the undo list); orders, the balance and recipients get their own sections.
  const account: Partial<State> = { ...state };
  for (const key of ["checkoutKeys", "cartRemoved", "orders", "entries", "deliveryProfiles"] as const) delete account[key];
  return {
    format: ACCOUNT_EXPORT_FORMAT,
    exportedAt: new Date(now).toISOString(),
    about: "Atlas: все данные вашего аккаунта на момент выгрузки. Суммы — в сумах (UZS), время — миллисекунды Unix (UTC). " +
      "Полные номера паспортов и ПИНФЛ хранятся на сервере только для таможни и здесь показаны последними цифрами; " +
      "их можно запросить через поддержку. Посылки (parcels) собраны из заказов: этап 0–7, номера заказов, получатель.",
    profile,
    signInMethods: input.signInMethods,
    balance: { amount: balanceOf(state), entries: state.entries },
    orders: state.orders.map((order) => {
      const copy: Partial<typeof order> = { ...order };
      delete copy.staffNotes;
      delete copy.assignment;
      return copy;
    }),
    parcels: buyerParcels(state.orders).map((parcel) => ({
      id: parcel.id, createdAt: parcel.createdAt, stage: parcel.stage ?? null, awaitingPayment: parcel.awaitingPayment,
      orderIds: parcel.orders.map((order) => order.id), ...(parcel.delivery ? { delivery: parcel.delivery } : {}),
    })),
    recipients: state.deliveryProfiles,
    account,
    consents: input.consents.map((row) => ({ document: row.document_key, version: row.document_version, acceptedAt: row.accepted_at })),
    passportRecords: input.passports.map((row) => ({ id: row.id, status: row.status, kind: row.filename === "passport-text" ? "typed" : "scan", createdAt: row.created_at })),
    orderDocuments: input.orderDocuments.map((row) => ({ id: row.id, orderId: row.order_id, kind: row.kind, filename: row.filename, contentType: row.content_type, size: row.size, createdAt: row.created_at })),
    promoCodeUses: input.promoUses.map((row) => ({ code: row.code, orderIds: orderIds(row.order_ids), discount: row.discount, usedAt: row.created_at, ...(row.returned_at ? { returnedAt: row.returned_at } : {}) })),
    browserNotifications: input.pushSubscriptions.map((row) => ({ service: pushService(row.endpoint), createdAt: row.created_at })),
  };
}

/** "atlas-data-2026-11-03.json" */
export const accountExportFilename = (now: number) => `atlas-data-${new Date(now).toISOString().slice(0, 10)}.json`;
