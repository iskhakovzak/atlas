CREATE TABLE `market_auth_links` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`method` text NOT NULL,
	`contact` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_auth_links_user` ON `market_auth_links` (`user_id`);