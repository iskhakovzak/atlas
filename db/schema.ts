import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
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

export const backupExports=sqliteTable('market_backup_exports',{
 id:text('id').primaryKey(),requestedBy:text('requested_by').notNull(),recordCount:integer('record_count').notNull(),checksum:text('checksum').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('idx_market_backup_exports_created').on(table.createdAt)]);
