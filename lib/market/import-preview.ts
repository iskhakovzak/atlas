// Anonymous preview never creates an account/cart. The shared ceiling also
// bounds work when the hosting edge omits or changes the client IP header.
export async function importRateBuckets(userId: string | undefined, edgeIp: string | null, now = Date.now()) {
  const minute = Math.floor(now / 60000);
  if (userId) return [{key: `${userId}:import:${minute}`, limit: 12}];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(edgeIp?.trim().slice(0,80) || 'unknown'));
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
  return [{key: `guest:import:global:${minute}`, limit: 60}, {key: `guest:import:${hash}:${minute}`, limit: 6}];
}
