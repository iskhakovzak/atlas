CREATE TABLE `market_auth_tokens` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`client_id` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_auth_tokens_user` ON `market_auth_tokens` (`user_id`);
