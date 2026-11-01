import assert from "node:assert/strict";
import { products, cartSignature } from "../lib/market/domain.ts";
import { customsVersion } from "../lib/market/world.ts";
import { promoDiscount } from "../lib/market/promo.ts";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:8787/");
if (!/^https?:$/.test(base.protocol)) throw Error("Expected an HTTP URL");
const customerEmail = `preflight-${Date.now()}@atlas.local`;
const operatorEmail = process.env.ATLAS_SMOKE_OPERATOR ?? "operator@atlas.local";
// Signs in through the real email-code flow. The local Worker must allow dev codes:
// npm start -- --var ATLAS_AUTH_DEV_CODES:true --var ATLAS_OPERATOR_EMAIL:operator@atlas.local
const sessions = new Map();
async function signIn(email) {
  const post = async (body, expectCookie) => {
    const response = await fetch(new URL("/api/auth/otp", base), { method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw Error(`sign-in ${body.step}: ${response.status} ${data.error ?? "failed"}`);
    return expectCookie ? response.headers.get("set-cookie")?.split(";")[0] : data;
  };
  const start = await post({ step: "start", channel: "email", target: email });
  if (!start.devCode) throw Error("Dev sign-in codes are disabled; start the Worker with ATLAS_AUTH_DEV_CODES=true on a loopback URL.");
  const cookie = await post({ step: "verify", channel: "email", challengeId: start.challengeId, code: start.devCode }, true);
  if (!cookie) throw Error("Sign-in did not return a session cookie");
  sessions.set(email, cookie);
}
const auth = (email) => ({ Cookie: sessions.get(email) ?? "" });
await signIn(customerEmail);
await signIn(operatorEmail);

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
await apply({ type: "cart-add", product: products[0], variant: products[0].variants[0] });
const delivery = { recipient: "Atlas Customer", phone: "+998901234567", region: "Ташкент", city: "Ташкент", address: "ул. Амира Темура, 10", postalCode: "100000", comment: "Предрелизный тест" };
// A promo code made by the operator (admin «Промокоды», redesign stage 6): it lowers only the Atlas service, once.
const promoCode = `SMOKE${Date.now().toString(36).toUpperCase()}`;
await request("/api/promo-codes", { email: operatorEmail, method: "POST", body: { promo: { code: promoCode.toLowerCase(), kind: "fixed", value: 1000, maxUses: 1, active: true } } });
const preview = await request("/api/promo", { method: "POST", body: { code: promoCode.toLowerCase() } });
assert.equal(preview.promo.code, promoCode);
const promoAmount = promoDiscount(preview.promo, account.state.cart).total;
assert.ok(promoAmount > 0);
await apply({ type: "checkout", key: crypto.randomUUID(), signature: cartSignature(account.state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery, promoCode, promoDiscount: promoAmount });
assert.equal(account.state.orders[0].quote.promoDiscount, promoAmount);
assert.equal(account.state.orders[0].promo.code, promoCode);
const usedUp = await fetch(new URL("/api/promo", base), { method: "POST", headers: { ...auth(customerEmail), "Content-Type": "application/json", Origin: base.origin }, body: JSON.stringify({ code: promoCode }) });
// The code check answers the same 404 err_87 for unknown, expired and used-up codes (nothing to learn by trying codes).
assert.equal(usedUp.status, 404, "a code with one use is used up after the order");
assert.equal((await usedUp.json()).errorCode, "err_87");
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
  account.revision = result.account.revision;
}
await operate({ type: "assign-order", id: orderId, team: "Закупки", priority: "Высокий" });
await operate({ type: "staff-note", id: orderId, text: "Автоматическая проверка предрелиза" });
await operate({ type: "change-request-create", id: orderId, kind: "variant", title: "Замена размера", reason: "Проверка защищённого согласования", previousValue: products[0].variants[0], proposedValue: products[0].variants[2], amountDelta: 0 });
const requestId=account.state.orders[0].changeRequests[0].id;
await apply({type:"change-request-respond",id:orderId,requestId,decision:"approved",expectedAmountDelta:0});
targetRevision=account.revision;
assert.equal(account.state.orders[0].variant,products[0].variants[2]);
await operate({ type: "advance", id: orderId, expected: 0 });
await operate({ type: "parcel-set", id: orderId, carrier: "Atlas Cargo", trackingNumber: `SMOKE-${Date.now()}`, warehouseCode: "WH-TAS-01" });
await operate({ type: "advance", id: orderId, expected: 1 });
await operate({ type: "warehouse-inspect", id: orderId, condition: "ok", quantityReceived: 1, notes: "Комплектность подтверждена", services: ["photo"], packageGroup: "SMOKE-BOX" });
await operate({ type: "receive", id: orderId, dimensions: [1.8, 30, 20, 15] });
await operate({ type: "advance", id: orderId, expected: 3 });
// On its way: the operator marks "Таможня" (stage 5) and "В Ташкенте" (6), then the delivery (1 November 2026).
await operate({ type: "advance", id: orderId, expected: 4 });
assert.equal(account.state.orders[0].transitStage, "customs");
await operate({ type: "advance", id: orderId, expected: 5 });
assert.equal(account.state.orders[0].transitStage, "tashkent");
await operate({ type: "advance", id: orderId, expected: 6 });
assert.equal(account.state.orders[0].status, 5);
assert.equal(account.state.orders[0].parcel.events.at(-1).status, "Доставлено получателю");
account = await request("/api/account");
const operations = await request("/api/operations", { email: operatorEmail });
assert(operations.accounts.some((item) => item.id === `email:${customerEmail}`));
assert(operations.staff.some((item) => item.email === operatorEmail && item.role === "admin" && item.status === "active"));
assert(operations.audit.some((item) => item.action === "order.advance" && item.entityId === orderId));
const staffEmail = `support-${Date.now()}@atlas.local`;
const staffResult = await request("/api/operations", { email: operatorEmail, method: "POST", body: { kind: "staff", value: { email: staffEmail, displayName: "Atlas Support", role: "support", status: "invited" } } });
assert(staffResult.staff.some((item) => item.email === staffEmail && item.role === "support"));
assert(staffResult.audit.some((item) => item.action === "staff.update" && item.entityId === staffEmail));
let catalog=(await request('/api/catalog?admin=1',{email:operatorEmail})).document;
const collectionId=`smoke-collection-${Date.now()}`;
catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'collection',collection:{id:collectionId,name:'Тестовая подборка',nameUz:'Sinov to‘plami',nameEn:'Test collection',description:'',visible:true,position:99}}}})).document;
// The live store import needs the US egress proxy (ATLAS_IMPORT_PROXY_*); without it, skip it explicitly.
const liveImport=process.env.ATLAS_SMOKE_SKIP_LIVE_IMPORT!=='1';
if(!liveImport)process.stdout.write('Skipping the live stevemadden.com import (ATLAS_SMOKE_SKIP_LIVE_IMPORT=1).\n');
if(liveImport){
// Store products come and go: compare with the store's own live price instead of a fixed number.
const liveUrl='https://www.stevemadden.com/products/divy-lime-leather';const livePrice=(await (await fetch(liveUrl+'.js',{headers:{'User-Agent':'Mozilla/5.0'}})).json()).price/100;
const imported=await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'import',url:liveUrl,collectionIds:[collectionId],country:'США'}}});
catalog=imported.document;const importedEntry=catalog.entries.find(item=>item.id===imported.importedId);assert(importedEntry.draft.images.length>1);assert(importedEntry.draft.variants.some(item=>item.available));assert.equal(importedEntry.draft.price,livePrice);
if(importedEntry.draft.reviewReasons?.length||importedEntry.draft.lastCheckError)catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'edit',id:imported.importedId,draft:importedEntry.draft}}})).document;
catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'publish',ids:[imported.importedId]}}})).document;
const publicCatalog=await request('/api/catalog');assert(publicCatalog.products.some(item=>item.id===imported.importedId));assert(publicCatalog.collections.some(item=>item.id===collectionId&&item.productIds.includes(imported.importedId)));
const publicEntry=publicCatalog.products.find(item=>item.id===imported.importedId);
await request('/api/catalog-availability',{method:'POST',body:{productId:publicEntry.id,sourceUrl:publicEntry.sourceUrl,answer:'available',variant:publicEntry.variants[0]}});
catalog=(await request('/api/catalog?admin=1',{email:operatorEmail})).document;
assert(catalog.availabilityReports.some(item=>item.productId===imported.importedId&&item.answer==='available'&&!item.resolvedAt));
catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'hide',ids:[imported.importedId]}}})).document;
assert(!(await request('/api/catalog')).products.some(item=>item.id===imported.importedId));
}
const proof=new Uint8Array(128);proof[0]=0xff;proof[1]=0xd8;proof[127]=0xd9;
const orderForm=new FormData();orderForm.append('orderId',orderId);orderForm.append('customerId',`email:${customerEmail}`);orderForm.append('kind','purchase-proof');orderForm.append('file',new File([proof],'purchase-proof.jpg',{type:'image/jpeg'}));
const orderUploadResponse=await fetch(new URL('/api/order-documents',base),{method:'POST',headers:{...auth(operatorEmail),Origin:base.origin},body:orderForm});assert.equal(orderUploadResponse.status,201);
const customerDocuments=await request('/api/order-documents');assert(customerDocuments.documents.some(item=>item.order_id===orderId&&item.kind==='purchase-proof'));
const backupResponse=await fetch(new URL('/api/backup',base),{headers:auth(operatorEmail)});assert.equal(backupResponse.status,200);assert.match(backupResponse.headers.get('x-atlas-checksum')??'',/^[a-f0-9]{64}$/);assert.equal((await backupResponse.json()).format,'atlas-backup-v1');
// Passport scans are refused since 13.10.2026: the details are typed and the server keeps them as text.
const scan = new Uint8Array(128);scan[0]=0xff;scan[1]=0xd8;scan[127]=0xd9;
const form = new FormData();form.append("file",new File([scan],"passport-smoke.jpg",{type:"image/jpeg"}));
const scanResponse=await fetch(new URL("/api/passport",base),{method:"POST",headers:{...auth(customerEmail),Origin:base.origin},body:form});assert.equal(scanResponse.status,410);
await apply({type:"identity-confirm",recipientProfileId:account.state.deliveryProfiles[0]?.id,firstName:"ATLAS",lastName:"CUSTOMER",birthDate:"1990-01-01",passportNumber:"AA1234567",nationality:"UZB"});
assert.equal(account.state.identityProfile.passportMasked,"•••• 4567");const typedId=account.state.identityProfile.documentId;assert.match(typedId,/^ID-/);
await apply({type:"declaration-preview",orderIds:[orderId]});
assert.equal(account.state.declarations[0].orderIds[0],orderId);
await request(`/api/passport?id=${encodeURIComponent(typedId)}`,{method:"DELETE",body:{}});
process.stdout.write(`Authenticated pre-release smoke passed: checkout with a promo code, fees, ${liveImport?'catalog import/publish, ':''}private order documents, backup export, passport, declaration, operations and delivery.\n`);
process.exit(0);
