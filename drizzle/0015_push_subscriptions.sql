-- Browser push subscriptions (27 October 2026): lib/market/push-server.ts. New table only; no data changes.
CREATE TABLE IF NOT EXISTS `market_push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_push_subscriptions_user` ON `market_push_subscriptions` (`user_id`,`created_at`);
