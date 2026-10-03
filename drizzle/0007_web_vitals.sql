CREATE TABLE `market_web_vitals` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`device` text NOT NULL,
	`ttfb_ms` real,
	`fcp_ms` real,
	`lcp_ms` real,
	`inp_ms` real,
	`cls` real,
	`api_slow` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_web_vitals_created` ON `market_web_vitals` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_web_vitals_route` ON `market_web_vitals` (`route`,`created_at`);