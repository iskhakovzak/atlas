-- Import monitor (30 October 2026): lib/market/import-monitor.ts. One row per live import attempt, kept 30 days.
-- New table only; no data changes.
CREATE TABLE IF NOT EXISTS `market_import_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`kind` text NOT NULL,
	`reason` text,
	`detail` text,
	`url` text NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_import_outcomes_host` ON `market_import_outcomes` (`host`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_import_outcomes_created` ON `market_import_outcomes` (`created_at`);
