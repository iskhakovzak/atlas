CREATE TABLE `market_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_audit_events_created` ON `market_audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_audit_events_entity_created` ON `market_audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `market_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`locale` text DEFAULT 'ru' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_customers_email` ON `market_customers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_market_customers_status_updated` ON `market_customers` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `market_legal_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`document_key` text NOT NULL,
	`document_version` text NOT NULL,
	`accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_legal_consents_customer_document_version` ON `market_legal_consents` (`customer_id`,`document_key`,`document_version`);--> statement-breakpoint
CREATE TABLE `market_order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor_id` text,
	`event_type` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_order_events_order_created` ON `market_order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `market_order_fee_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'UZS' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_order_fee_lines_order` ON `market_order_fee_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `market_order_records` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`source_store` text,
	`source_url` text,
	`currency` text DEFAULT 'UZS' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`assigned_role` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_order_records_customer_created` ON `market_order_records` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_order_records_status_updated` ON `market_order_records` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `market_staff_directory` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_staff_directory_email` ON `market_staff_directory` (`email`);--> statement-breakpoint
CREATE INDEX `idx_market_staff_directory_status_role` ON `market_staff_directory` (`status`,`role`);