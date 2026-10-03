import { requestJson, sameOrigin } from '@/lib/market/server';
import { parseCspReport, parseTelemetry, vitalsSampleRate } from '@/lib/market/telemetry';
import { pruneTelemetry, recordClientErrors, recordClientProblem, recordVitals, telemetryAllowed } from '@/lib/market/telemetry-store';

const accepted = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

// Field monitoring: script errors and page speed sent by app/performance-probe.tsx, and
// Content-Security-Policy violation reports. The answer is always an empty 204, so a rejected
// or malformed report never affects the page that sent it.
export async function POST(request: Request) {
  // Read the body before any check: answering with request bytes left unread stalls the next
  // request on the same keep-alive connection (seen locally as 15-second hangs).
  let body: unknown = null;
  try { body = await requestJson(request, 16 * 1024); } catch { /* malformed or too large */ }
  try {
    const csp = (request.headers.get('content-type') ?? '').includes('csp-report');
    // Browsers send CSP reports on their own; everything else must come from Atlas pages.
    if (!csp) sameOrigin(request);
    if (body === null || !(await telemetryAllowed(request))) return accepted();
    if (csp) {
      const report = parseCspReport(body);
      if (report) await recordClientProblem('csp', report.message, { route: report.route, ...(report.source ? { source: report.source } : {}) });
    } else {
      const payload = parseTelemetry(body);
      if (payload) {
        await recordClientErrors(payload.errors);
        if (payload.vitals && Math.random() < vitalsSampleRate) await recordVitals(payload.vitals);
      }
    }
    if (Math.random() < 0.02) await pruneTelemetry();
  } catch {
    // Monitoring is best effort.
  }
  return accepted();
}
