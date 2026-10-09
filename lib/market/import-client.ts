/** What POST /api/import answers with 202 while a Walmart/H&M collection is still running (lib/importer/brightdata.ts). */
export type ImportPending = {pending: true; retryAfterMs?: number; message?: string; sourceUrl?: string};

export type ImportRequestOptions = {
  /** Called on every 202 with the server's message, so the page can say what it is waiting for. */
  onPending?: (pending: ImportPending, waitedMs: number) => void;
  /** Stop waiting (the customer pasted another link or left the page). */
  isCancelled?: () => boolean;
  /** H&M can take ~6 minutes on Bright Data's side; after this the page offers manual entry. */
  maxWaitMs?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const pendingResponse = (pending: ImportPending) => new Response(JSON.stringify(pending), {status: 202, headers: {'Content-Type': 'application/json'}});

/**
 * POST /api/import, asking again while the server answers 202 (the same collection is polled, never paid twice).
 * Returns the final response; when waiting runs out it returns a 422 shaped like the server's manual-entry answer.
 */
export async function requestImport(body: {url: string; fresh?: boolean}, options: ImportRequestOptions = {}): Promise<Response> {
  const fetcher = options.fetcher ?? fetch, sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const maxWaitMs = options.maxWaitMs ?? 10 * 60_000, started = Date.now();
  let last: ImportPending | undefined;
  for (;;) {
    const response = await fetcher('/api/import', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)});
    if (response.status !== 202) return response;
    last = await response.json().catch(() => ({pending: true})) as ImportPending;
    const waited = Date.now() - started;
    options.onPending?.(last, waited);
    if (options.isCancelled?.()) return pendingResponse(last);
    if (waited >= maxWaitMs) break;
    await sleep(Math.min(15_000, Math.max(2_000, Number(last.retryAfterMs) || 4_000)));
    if (options.isCancelled?.()) return pendingResponse(last);
  }
  return new Response(JSON.stringify({sourceUrl: last?.sourceUrl ?? body.url, warnings: [], error: last?.message ?? 'Магазин не успел отдать данные. Заполните товар вручную или повторите позже.', manualEntryAvailable: true}), {status: 422, headers: {'Content-Type': 'application/json'}});
}
