declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ATLAS_OPERATOR_EMAIL?: string;
    ATLAS_CATALOG_REFRESH_SECRET?: string;
    ATLAS_IMPORT_PROXY_URL?: string;
    ATLAS_IMPORT_PROXY_SECRET?: string;
    BUCKET?: R2Bucket;
    // Sign-in. Each method is offered only when its provider settings are present.
    ATLAS_AUTH_SECRET?: string;
    ATLAS_AUTH_DEV_CODES?: string;
    RESEND_API_KEY?: string;
    ATLAS_AUTH_EMAIL_FROM?: string;
    ESKIZ_EMAIL?: string;
    ESKIZ_PASSWORD?: string;
    ESKIZ_FROM?: string;
    ATLAS_SMS_TEMPLATE?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_USERNAME?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
