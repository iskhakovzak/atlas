declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ATLAS_OPERATOR_EMAIL?: string;
    /** Search Console / Yandex Webmaster meta-tag codes (content of the tag only). */
    ATLAS_GOOGLE_SITE_VERIFICATION?: string;
    ATLAS_YANDEX_VERIFICATION?: string;
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
    /**
     * Order notices in Telegram: "on" lets this deployment message customers, "off" stops it. Unset — only
     * the public site (atlasmarket.uz over https) sends, so staging with the same bot token never does.
     */
    ATLAS_TELEGRAM_NOTICES?: string;
    /**
     * Import monitor (lib/market/import-monitor.ts): "on"/"off" overrides; unset — only the public site tells the
     * owner. ATLAS_MONITOR_TELEGRAM is the owner's numeric Telegram id (otherwise the Telegram attached to the
     * operator account); ATLAS_IMPORT_MONITOR_SECRET signs the 10-minute call of workers/import-monitor.
     */
    ATLAS_IMPORT_MONITOR?: string;
    ATLAS_MONITOR_TELEGRAM?: string;
    ATLAS_IMPORT_MONITOR_SECRET?: string;
    ATLAS_TASHKENT_PROXY_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    // Sign in with Apple: the web flow uses the Services ID, the iOS app sends tokens for its bundle ID;
    // the key signs the client secret for token exchange and revocation (AUTH_SETUP.md).
    APPLE_SERVICES_ID?: string;
    APPLE_APP_BUNDLE_ID?: string;
    APPLE_TEAM_ID?: string;
    APPLE_KEY_ID?: string;
    APPLE_PRIVATE_KEY?: string;
    // App Store / Google Play reviewers: "email=code" pairs whose email code is fixed and never sent.
    ATLAS_REVIEW_ACCOUNTS?: string;
    // Android App Links (/.well-known/assetlinks.json): package name and signing certificate SHA-256 fingerprints.
    ANDROID_PACKAGE_NAME?: string;
    ANDROID_CERT_SHA256?: string;
  }
}
