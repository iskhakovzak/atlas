import {sqliteTable,text,integer,real,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('market_accounts',{userId:text('user_id').primaryKey(),name:text('name').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()});
export const limits=sqliteTable('market_rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
export const settings=sqliteTable('market_settings',{key:text('key').primaryKey(),value:text('value').notNull(),updatedAt:integer('updated_at').notNull(),updatedBy:text('updated_by').notNull()});
export const importCache=sqliteTable('market_import_cache',{url:text('url').primaryKey(),payload:text('payload').notNull(),expiresAt:integer('expires_at').notNull(),updatedAt:integer('updated_at').notNull()});
export const identityDocuments=sqliteTable('market_identity_documents',{id:text('id').primaryKey(),userId:text('user_id').notNull(),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),contentType:text('content_type').notNull(),size:integer('size').notNull(),status:text('status').notNull().default('uploaded'),confirmedData:text('confirmed_data'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()},table=>[index('idx_market_identity_documents_user_created').on(table.userId,table.createdAt)]);

export const customers=sqliteTable('market_customers',{
 id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),phone:text('phone'),locale:text('locale').notNull().default('ru'),status:text('status').notNull().default('active'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},table=>[uniqueIndex('idx_market_customers_email').on(table.email),index('idx_market_customers_status_updated').on(table.status,table.updatedAt)]);

export const orderRecords=sqliteTable('market_order_records',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull(),status:text('status').notNull(),sourceStore:text('source_store'),sourceUrl:text('source_url'),currency:text('currency').notNull().default('UZS'),total:integer('total').notNull().default(0),assignedRole:text('assigned_role'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},table=>[index('idx_market_order_records_customer_created').on(table.customerId,table.createdAt),index('idx_market_order_records_status_updated').on(table.status,table.updatedAt)]);

export const orderFeeLines=sqliteTable('market_order_fee_lines',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull(),kind:text('kind').notNull(),label:text('label').notNull(),amount:integer('amount').notNull(),currency:text('currency').notNull().default('UZS'),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_order_fee_lines_order').on(table.orderId)]);

export const orderEvents=sqliteTable('market_order_events',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull(),actorId:text('actor_id'),eventType:text('event_type').notNull(),payload:text('payload'),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_order_events_order_created').on(table.orderId,table.createdAt)]);

export const staffDirectory=sqliteTable('market_staff_directory',{
 id:text('id').primaryKey(),email:text('email').notNull(),displayName:text('display_name').notNull(),role:text('role').notNull(),status:text('status').notNull().default('invited'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},table=>[uniqueIndex('idx_market_staff_directory_email').on(table.email),index('idx_market_staff_directory_status_role').on(table.status,table.role)]);

export const auditEvents=sqliteTable('market_audit_events',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),action:text('action').notNull(),entityType:text('entity_type').notNull(),entityId:text('entity_id'),details:text('details'),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_audit_events_created').on(table.createdAt),index('idx_market_audit_events_entity_created').on(table.entityType,table.entityId,table.createdAt)]);

export const legalConsents=sqliteTable('market_legal_consents',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull(),documentKey:text('document_key').notNull(),documentVersion:text('document_version').notNull(),acceptedAt:integer('accepted_at').notNull(),
},table=>[uniqueIndex('idx_market_legal_consents_customer_document_version').on(table.customerId,table.documentKey,table.documentVersion)]);

export const orderDocuments=sqliteTable('market_order_documents',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull(),customerId:text('customer_id').notNull(),kind:text('kind').notNull(),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),contentType:text('content_type').notNull(),size:integer('size').notNull(),uploadedBy:text('uploaded_by').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_order_documents_customer_created').on(table.customerId,table.createdAt),index('idx_market_order_documents_order_created').on(table.orderId,table.createdAt)]);

export const operationalErrors=sqliteTable('market_operational_errors',{
 id:text('id').primaryKey(),area:text('area').notNull(),message:text('message').notNull(),details:text('details'),createdAt:integer('created_at').notNull(),resolvedAt:integer('resolved_at'),
},table=>[index('idx_market_operational_errors_created').on(table.createdAt),index('idx_market_operational_errors_open').on(table.resolvedAt,table.createdAt)]);

// Session IDs are SHA-256 hashes of the cookie token; the raw token is never stored.
export const authSessions=sqliteTable('market_auth_sessions',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),method:text('method').notNull(),email:text('email'),displayName:text('display_name').notNull(),contact:text('contact').notNull(),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
},table=>[index('idx_market_auth_sessions_user').on(table.userId),index('idx_market_auth_sessions_expires').on(table.expiresAt)]);

// One-time sign-in challenges: hashed email/SMS codes, or Google OAuth state with its PKCE verifier.
export const authChallenges=sqliteTable('market_auth_challenges',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),target:text('target').notNull(),secret:text('secret').notNull(),attempts:integer('attempts').notNull().default(0),returnTo:text('return_to'),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
},table=>[index('idx_market_auth_challenges_expires').on(table.expiresAt)]);

// Extra sign-in methods attached to an account: signing in as `subject` ("tg:123", "phone:+998…", "email:…")
// opens the account `user_id`. An account's own first method has no row here.
export const authLinks=sqliteTable('market_auth_links',{
 subject:text('subject').primaryKey(),userId:text('user_id').notNull(),method:text('method').notNull(),contact:text('contact').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_auth_links_user').on(table.userId)]);

// Refresh tokens from sign-in providers (Apple), sealed with a key from ATLAS_AUTH_SECRET; revoked and deleted with the account.
export const authTokens=sqliteTable('market_auth_tokens',{
 subject:text('subject').primaryKey(),userId:text('user_id').notNull(),provider:text('provider').notNull(),clientId:text('client_id').notNull(),token:text('token').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_auth_tokens_user').on(table.userId)]);

// Accounting (lib/market/finance.ts). One money movement per row, in soum; rows are voided, never deleted.
export const ledgerEntries=sqliteTable('market_ledger_entries',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),amountUzs:integer('amount_uzs').notNull(),originalAmount:real('original_amount'),originalCurrency:text('original_currency'),occurredOn:text('occurred_on').notNull(),orderId:text('order_id'),counterparty:text('counterparty'),note:text('note'),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull(),voidedAt:integer('voided_at'),voidedBy:text('voided_by'),voidReason:text('void_reason'),
},table=>[index('idx_market_ledger_entries_occurred').on(table.occurredOn),index('idx_market_ledger_entries_order').on(table.orderId),index('idx_market_ledger_entries_kind').on(table.kind)]);

// Each order in the books, rebuilt from the account state with the rest of the operational projection.
export const orderFinance=sqliteTable('market_order_finance',{
 orderId:text('order_id').primaryKey(),customerId:text('customer_id').notNull(),status:text('status').notNull(),createdAt:integer('created_at').notNull(),paidAt:integer('paid_at'),month:text('month'),
 goods:integer('goods').notNull(),storeShipping:integer('store_shipping').notNull(),reserve:integer('reserve').notNull(),payable:integer('payable').notNull(),
 commission:integer('commission').notNull(),delivery:integer('delivery').notNull(),fxGain:integer('fx_gain').notNull(),services:integer('services').notNull(),revenue:integer('revenue').notNull(),updatedAt:integer('updated_at').notNull(),
},table=>[index('idx_market_order_finance_month').on(table.month),index('idx_market_order_finance_customer').on(table.customerId)]);

export const backupExports=sqliteTable('market_backup_exports',{
 id:text('id').primaryKey(),requestedBy:text('requested_by').notNull(),recordCount:integer('record_count').notNull(),checksum:text('checksum').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_backup_exports_created').on(table.createdAt)]);

// Anonymous page-speed samples from visitors' browsers: route pattern and device class only
// (no account, IP or query string). Kept 30 days; the operator dashboard shows p75 per route.
export const webVitals=sqliteTable('market_web_vitals',{
 id:text('id').primaryKey(),route:text('route').notNull(),device:text('device').notNull(),ttfbMs:real('ttfb_ms'),fcpMs:real('fcp_ms'),lcpMs:real('lcp_ms'),inpMs:real('inp_ms'),cls:real('cls'),apiSlow:integer('api_slow'),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_web_vitals_created').on(table.createdAt),index('idx_market_web_vitals_route').on(table.route,table.createdAt)]);
