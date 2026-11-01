-- Promo codes (redesign stage 6, 1 November 2026): lib/market/promo.ts, lib/market/promo-store.ts.
-- New tables and one new column with a default; no data changes. A code lowers only the Atlas service of a checkout.
CREATE TABLE IF NOT EXISTS `market_promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`max_uses` integer,
	`min_order` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_market_promo_codes_code` ON `market_promo_codes` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `market_promo_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`order_ids` text NOT NULL,
	`discount` integer NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_market_promo_redemptions_batch` ON `market_promo_redemptions` (`batch_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_promo_redemptions_code` ON `market_promo_redemptions` (`code_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `market_order_finance` ADD `promo_discount` integer DEFAULT 0 NOT NULL;
