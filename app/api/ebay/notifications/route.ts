import {env} from 'cloudflare:workers';
import {
  createEbayChallengeResponse,
  EbayNotificationVerificationError,
  readEbayNotificationBody,
  verifyEbayNotification,
} from '@/lib/market/ebay-notifications';

type EbayRuntime = {
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_NOTIFICATION_VERIFICATION_TOKEN?: string;
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
}

function noContent(status = 204) {
  return new Response(null, {status, headers: {'Cache-Control': 'no-store'}});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(request: Request) {
  const challengeCode = new URL(request.url).searchParams.get('challenge_code');
  if (!challengeCode || challengeCode.length > 2_048) return reply({error: 'Invalid challenge.'}, 400);
  const bindings = env as unknown as EbayRuntime;
  const token = bindings.EBAY_NOTIFICATION_VERIFICATION_TOKEN ?? '';
  try {
    return reply({challengeResponse: await createEbayChallengeResponse(challengeCode, token)});
  } catch {
    return reply({error: 'Notification endpoint is not configured.'}, 503);
  }
}

export async function POST(request: Request) {
  if (!/application\/json/i.test(request.headers.get('content-type') ?? '')) return noContent(415);
  const signature = request.headers.get('x-ebay-signature');
  if (!signature) return noContent(412);

  let text: string;
  try {
    text = await readEbayNotificationBody(request);
  } catch (error) {
    return noContent(error instanceof RangeError ? 413 : 400);
  }

  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    return noContent(400);
  }
  if (!isRecord(message) || !isRecord(message.metadata) || !isRecord(message.notification)) return noContent(400);
  if (message.metadata.topic !== 'MARKETPLACE_ACCOUNT_DELETION') return noContent(204);

  const bindings = env as unknown as EbayRuntime;
  try {
    const valid = await verifyEbayNotification(message, signature, {
      clientId: bindings.EBAY_CLIENT_ID,
      clientSecret: bindings.EBAY_CLIENT_SECRET,
    });
    if (!valid) return noContent(412);
  } catch (error) {
    if (error instanceof EbayNotificationVerificationError) return noContent(503);
    return noContent(503);
  }

  // Atlas stores imported listing fields, not eBay member profiles or the
  // userId/eiasToken values in this notification. A valid request therefore
  // requires no account lookup or retention of the notification payload.
  return noContent(204);
}
