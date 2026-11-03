// Stand-in for `cloudflare:workers` in route tests (tests/support/route-harness.mjs): the harness fills `env`.
export const env = (globalThis.__atlasTestEnv ??= {});
export function waitUntil(task) {
  (globalThis.__atlasTestBackground ??= []).push(Promise.resolve(task).catch(() => {}));
}
