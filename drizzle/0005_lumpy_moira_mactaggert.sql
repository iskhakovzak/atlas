CREATE TABLE `market_backup_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_by` text NOT NULL,
	`record_count` integer NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_backup_exports_created` ON `market_backup_exports` (`created_at`);--> statement-breakpoint
CREATE TABLE `market_operational_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`area` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_market_operational_errors_created` ON `market_operational_errors` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_operational_errors_open` ON `market_operational_errors` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `market_order_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_order_documents_customer_created` ON `market_order_documents` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_order_documents_order_created` ON `market_order_documents` (`order_id`,`created_at`);