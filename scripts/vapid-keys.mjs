// Prints a new VAPID key pair for browser notifications (lib/market/push-server.ts). Put both values into the
// hosting's secrets as ATLAS_VAPID_PUBLIC_KEY and ATLAS_VAPID_PRIVATE_KEY (optionally ATLAS_VAPID_SUBJECT=mailto:…).
// Keep the pair: a new pair makes every browser subscribe again. Run: node scripts/vapid-keys.mjs
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log(`ATLAS_VAPID_PUBLIC_KEY=${publicKey}\nATLAS_VAPID_PRIVATE_KEY=${d}`);
