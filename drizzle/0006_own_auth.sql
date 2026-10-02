CREATE TABLE `market_auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`target` text NOT NULL,
	`secret` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`return_to` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_auth_challenges_expires` ON `market_auth_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `market_auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`method` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`contact` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_auth_sessions_user` ON `market_auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_market_auth_sessions_expires` ON `market_auth_sessions` (`expires_at`);