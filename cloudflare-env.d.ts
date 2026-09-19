declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ATLAS_OPERATOR_EMAIL?: string;
    ATLAS_CATALOG_REFRESH_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
