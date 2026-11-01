-- Owner decisions (2 November 2026): lib/market/promo.ts, lib/market/promo-store.ts.
-- «Один раз на покупателя» per code (existing codes keep the old behaviour: off) and the mark of a use given back when
-- its checkout was cancelled before the purchase. New columns with defaults and one index; no data changes.
ALTER TABLE `market_promo_codes` ADD `once_per_customer` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_promo_redemptions` ADD `returned_at` integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_promo_redemptions_user` ON `market_promo_redemptions` (`code_id`,`user_id`);
