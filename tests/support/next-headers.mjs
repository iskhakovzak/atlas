// Stand-in for `next/headers` in route tests: the request the harness is calling.
export async function headers() {
  return globalThis.__atlasTestRequest?.headers ?? new Headers();
}
export async function cookies() {
  const header = globalThis.__atlasTestRequest?.headers.get('cookie') ?? '';
  const jar = new Map(header.split(/;\s*/).filter(Boolean).map((pair) => {
    const at = pair.indexOf('=');
    return [pair.slice(0, at), {name: pair.slice(0, at), value: decodeURIComponent(pair.slice(at + 1))}];
  }));
  return {get: (name) => jar.get(name), has: (name) => jar.has(name), getAll: () => [...jar.values()]};
}
