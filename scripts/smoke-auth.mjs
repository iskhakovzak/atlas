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
await operate({ type: "advance", id: orderId, expected: 4 });
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
const imported=await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'import',url:'https://www.stevemadden.com/products/possession-black',collectionIds:[collectionId],country:'США'}}});
catalog=imported.document;const importedEntry=catalog.entries.find(item=>item.id===imported.importedId);assert(importedEntry.draft.images.length>1);assert(importedEntry.draft.variants.some(item=>item.available));assert.equal(importedEntry.draft.price,79.99);
if(importedEntry.draft.reviewReasons?.length||importedEntry.draft.lastCheckError)catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'edit',id:imported.importedId,draft:importedEntry.draft}}})).document;
catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'publish',ids:[imported.importedId]}}})).document;
const publicCatalog=await request('/api/catalog');assert(publicCatalog.products.some(item=>item.id===imported.importedId));assert(publicCatalog.collections.some(item=>item.id===collectionId&&item.productIds.includes(imported.importedId)));
const publicEntry=publicCatalog.products.find(item=>item.id===imported.importedId);
await request('/api/catalog-availability',{method:'POST',body:{productId:publicEntry.id,sourceUrl:publicEntry.sourceUrl,answer:'available',variant:publicEntry.variants[0]}});
catalog=(await request('/api/catalog?admin=1',{email:operatorEmail})).document;
assert(catalog.availabilityReports.some(item=>item.productId===imported.importedId&&item.answer==='available'&&!item.resolvedAt));
catalog=(await request('/api/catalog',{email:operatorEmail,method:'POST',body:{revision:catalog.revision,command:{kind:'hide',ids:[imported.importedId]}}})).document;
assert(!(await request('/api/catalog')).products.some(item=>item.id===imported.importedId));
const proof=new Uint8Array(128);proof[0]=0xff;proof[1]=0xd8;proof[127]=0xd9;
const orderForm=new FormData();orderForm.append('orderId',orderId);orderForm.append('customerId',`email:${customerEmail}`);orderForm.append('kind','purchase-proof');orderForm.append('file',new File([proof],'purchase-proof.jpg',{type:'image/jpeg'}));
const orderUploadResponse=await fetch(new URL('/api/order-documents',base),{method:'POST',headers:{...auth(operatorEmail),Origin:base.origin},body:orderForm});assert.equal(orderUploadResponse.status,201);
const customerDocuments=await request('/api/order-documents');assert(customerDocuments.documents.some(item=>item.order_id===orderId&&item.kind==='purchase-proof'));
const backupResponse=await fetch(new URL('/api/backup',base),{headers:auth(operatorEmail)});assert.equal(backupResponse.status,200);assert.match(backupResponse.headers.get('x-atlas-checksum')??'',/^[a-f0-9]{64}$/);assert.equal((await backupResponse.json()).format,'atlas-backup-v1');
const scan = new Uint8Array(128);scan[0]=0xff;scan[1]=0xd8;scan[127]=0xd9;
const form = new FormData();form.append("file",new File([scan],"passport-smoke.jpg",{type:"image/jpeg"}));
const uploaded = await requestForm("/api/passport",form);
await apply({type:"identity-confirm",documentId:uploaded.document.id,firstName:"ATLAS",lastName:"CUSTOMER",birthDate:"1990-01-01",passportNumber:"AA1234567",nationality:"UZB"});
assert.equal(account.state.identityProfile.passportMasked,"•••• 4567");
await apply({type:"declaration-preview",orderIds:[orderId]});
assert.equal(account.state.declarations[0].orderIds[0],orderId);
await request(`/api/passport?id=${encodeURIComponent(uploaded.document.id)}`,{method:"DELETE",body:{}});
process.stdout.write("Authenticated pre-release smoke passed: checkout, fees, catalog import/publish, private order documents, backup export, passport, declaration, operations and delivery.\n");
process.exit(0);
