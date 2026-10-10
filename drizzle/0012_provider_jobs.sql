CREATE TABLE `market_provider_jobs` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`store` text NOT NULL,
	`dataset` text NOT NULL,
	`item_key` text NOT NULL,
	`url` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`records` integer DEFAULT 0 NOT NULL,
	`error` text,
	`month` text NOT NULL,
	`day` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_market_provider_jobs_item` ON `market_provider_jobs` (`item_key`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_market_provider_jobs_month` ON `market_provider_jobs` (`provider`,`month`);
--> statement-breakpoint
CREATE INDEX `idx_market_provider_jobs_day` ON `market_provider_jobs` (`provider`,`day`);
