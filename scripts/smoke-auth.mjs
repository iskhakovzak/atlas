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
async function requestForm(path, form, method = "POST") {
  const response = await fetch(new URL(path, base), { method, headers: { ...auth(customerEmail), Origin: base.origin }, body: form });
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
account = await request("/api/account");
const operations = await request("/api/operations", { email: operatorEmail });
assert(operations.accounts.some((item) => item.id === `email:${customerEmail}`));
const scan = new Uint8Array(128);scan[0]=0xff;scan[1]=0xd8;scan[127]=0xd9;
const form = new FormData();form.append("file",new File([scan],"passport-smoke.jpg",{type:"image/jpeg"}));
const uploaded = await requestForm("/api/passport",form);
await apply({type:"identity-confirm",documentId:uploaded.document.id,firstName:"ATLAS",lastName:"CUSTOMER",birthDate:"1990-01-01",passportNumber:"AA1234567",nationality:"UZB"});
assert.equal(account.state.identityProfile.passportMasked,"•••• 4567");
await apply({type:"declaration-preview",orderIds:[orderId]});
assert.equal(account.state.declarations[0].orderIds[0],orderId);
await request(`/api/passport?id=${encodeURIComponent(uploaded.document.id)}`,{method:"DELETE",body:{}});
process.stdout.write("Authenticated pre-release smoke passed: checkout, payment, passport, declaration, assignment, notes, parcel, tracking, delivery, email/SMS preview.\n");
process.exit(0);
