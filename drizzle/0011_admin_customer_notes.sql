CREATE TABLE `market_customer_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_email` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_customer_notes_customer_created` ON `market_customer_notes` (`customer_id`,`created_at`);
