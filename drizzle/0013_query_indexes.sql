CREATE INDEX IF NOT EXISTS `idx_market_rate_limits_expires` ON `market_rate_limits` (`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_import_cache_expires` ON `market_import_cache` (`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_accounts_updated` ON `market_accounts` (`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_auth_sessions_email` ON `market_auth_sessions` (`email`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_audit_events_actor_created` ON `market_audit_events` (`actor_email`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_audit_events_type_created` ON `market_audit_events` (`entity_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_operational_errors_problem` ON `market_operational_errors` (`area`,`message`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_order_finance_created` ON `market_order_finance` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_order_finance_status_created` ON `market_order_finance` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_ledger_entries_kind_occurred` ON `market_ledger_entries` (`kind`,`occurred_on`);
