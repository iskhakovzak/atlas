/** What POST /api/import answers with 202 while a Walmart collection is still running (lib/importer/brightdata.ts). */
export type ImportPending = {pending: true; retryAfterMs?: number; message?: string; sourceUrl?: string};

export type ImportRequestOptions = {
  /** Called on every 202 with the server's message, so the page can say what it is waiting for. */
  onPending?: (pending: ImportPending, waitedMs: number) => void;
  /** Stop waiting (the customer pasted another link or left the page). */
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  /** Walmart usually needs 5–25 s on Bright Data's side; after this the page offers manual entry. */
  maxWaitMs?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const pendingResponse = (pending: ImportPending) => new Response(JSON.stringify(pending), {status: 202, headers: {'Content-Type': 'application/json'}});

function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, {once: true});
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    }
  });
}

/**
 * POST /api/import, asking again while the server answers 202 (the same collection is polled, never paid twice).
 * Returns the final response; when waiting runs out it returns a 422 shaped like the server's manual-entry answer.
 */
export async function requestImport(body: {url: string; fresh?: boolean; reuseRecent?: boolean}, options: ImportRequestOptions = {}): Promise<Response> {
  const {signal, isCancelled} = options;
  const fetcher = options.fetcher ?? fetch;
  const cancelled = () => signal?.aborted || isCancelled?.();
  const maxWaitMs = options.maxWaitMs ?? 2 * 60_000, started = Date.now();
  let last: ImportPending | undefined;
  for (;;) {
    if (cancelled()) return pendingResponse(last ?? {pending: true});
    let response: Response;
    try {
      response = await fetcher('/api/import', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body), signal});
    } catch (error) {
      if (cancelled()) return pendingResponse(last ?? {pending: true});
      throw error;
    }
    if (cancelled()) return pendingResponse(last ?? {pending: true});
    if (response.status !== 202) return response;
    const data = await response.json().catch(() => null) as ImportPending | null;
    last = data?.pending === true ? data : {pending: true};
    if (cancelled()) return pendingResponse(last);
    const waited = Date.now() - started;
    options.onPending?.(last, waited);
    if (cancelled()) return pendingResponse(last);
    const remaining = maxWaitMs - (Date.now() - started);
    if (remaining <= 0) break;
    const delay = Math.min(remaining, Math.min(15_000, Math.max(2_000, Number(last.retryAfterMs) || 4_000)));
    await (options.sleep ? options.sleep(delay) : waitForPoll(delay, signal));
    if (cancelled()) return pendingResponse(last);
    if (Date.now() - started >= maxWaitMs) break;
  }
  return new Response(JSON.stringify({sourceUrl: last?.sourceUrl ?? body.url, warnings: [], error: last?.message ?? 'Магазин не успел отдать данные. Заполните товар вручную или повторите позже.', manualEntryAvailable: true}), {status: 422, headers: {'Content-Type': 'application/json'}});
}
