declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ATLAS_OPERATOR_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
