import assert from "node:assert/strict";
import { products, cartSignature } from "../lib/market/domain.ts";
import { customsVersion } from "../lib/market/world.ts";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:8787/");
if (!/^https?:$/.test(base.protocol)) throw Error("Expected an HTTP URL");
const customerEmail = `preflight-${Date.now()}@atlas.local`;
const operatorEmail = process.env.ATLAS_SMOKE_OPERATOR ?? "operator@atlas.local";
const auth = (email) => ({
  "oai-authenticated-user-id": `smoke:${email}`,
  "oai-authenticated-user-email": email,
  "oai-authenticated-user-full-name": encodeURIComponent(email === operatorEmail ? "Atlas Operator" : "Atlas Customer"),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});

async function request(path, { email = customerEmail, method = "GET", body } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { ...auth(email), ...(body ? { "Content-Type": "application/json", Origin: base.origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(`${method} ${path}: ${response.status} ${data.error ?? "failed"}`);
  return data;
}

let account = await request("/api/account");
const apply = async (action) => {
  account = await request("/api/actions", { method: "POST", body: { action, revision: account.revision } });
  return account;
};

await apply({ type: "communication-save", value: { emailEnabled: true, smsEnabled: true, email: customerEmail, phone: "+998901234567", language: "ru" } });
await apply({ type: "cart-add", product: { ...products[0], id: `smoke-${Date.now()}` }, variant: products[0].variants[0] });
const delivery = { recipient: "Atlas Customer", phone: "+998901234567", region: "Ташкент", city: "Ташкент", address: "ул. Амира Темура, 10", postalCode: "100000", comment: "Предрелизный тест" };
await apply({ type: "checkout", key: crypto.randomUUID(), signature: cartSignature(account.state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery });
const orderId = account.state.orders[0].id;
assert.equal(account.state.orders[0].payment.status, "pending");
await apply({ type: "payment-demo", id: orderId });
assert.equal(account.state.orders[0].payment.status, "paid");
assert.equal(account.state.messageDeliveries.length, 2);

let targetRevision = account.revision;
async function operate(action) {
  const result = await request("/api/operations", { email: operatorEmail, method: "POST", body: { kind: "action", accountId: `email:${customerEmail}`, revision: targetRevision, action } });
  targetRevision = result.account.revision;
  account.state = result.account.state;
}
await operate({ type: "assign-order", id: orderId, team: "Закупки", priority: "Высокий" });
await operate({ type: "staff-note", id: orderId, text: "Автоматическая проверка предрелиза" });
await operate({ type: "advance", id: orderId, expected: 0 });
await operate({ type: "parcel-set", id: orderId, carrier: "Atlas Cargo", trackingNumber: `SMOKE-${Date.now()}`, warehouseCode: "WH-TAS-01" });
await operate({ type: "advance", id: orderId, expected: 1 });
await operate({ type: "receive", id: orderId, dimensions: [1.8, 30, 20, 15] });
await operate({ type: "advance", id: orderId, expected: 3 });
await operate({ type: "advance", id: orderId, expected: 4 });
assert.equal(account.state.orders[0].status, 5);
assert.equal(account.state.orders[0].parcel.events.at(-1).status, "Доставлено получателю");
const operations = await request("/api/operations", { email: operatorEmail });
assert(operations.accounts.some((item) => item.id === `email:${customerEmail}`));
process.stdout.write("Authenticated pre-release smoke passed: checkout, payment, assignment, notes, parcel, tracking, delivery, email/SMS preview.\n");
