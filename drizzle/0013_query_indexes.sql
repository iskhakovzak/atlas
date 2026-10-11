-- Indexes for the columns the server filters and sorts by (11 October 2026): the operations list (accounts by
-- updated_at), finance month/year reads, rate-limit and import-cache cleanup, staff sign-ins, the audit filter by actor
-- and the Bright Data job settlement. Only indexes: no data changes.
CREATE INDEX IF NOT EXISTS `idx_market_provider_jobs_status` ON `market_provider_jobs` (`provider`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_accounts_updated` ON `market_accounts` (`updated_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_audit_events_actor_created` ON `market_audit_events` (`actor_email`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_auth_sessions_email` ON `market_auth_sessions` (`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_import_cache_expires` ON `market_import_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_rate_limits_expires` ON `market_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_order_finance_created` ON `market_order_finance` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_order_finance_status_created` ON `market_order_finance` (`status`,`created_at`);
