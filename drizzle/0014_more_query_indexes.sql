-- More indexes for server filters (11 October 2026): the audit filter by entity type, folding repeated client errors
-- and the ledger by kind and date. Only indexes, safe to apply again; no data changes.
CREATE INDEX IF NOT EXISTS `idx_market_audit_events_type_created` ON `market_audit_events` (`entity_type`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_operational_errors_problem` ON `market_operational_errors` (`area`,`message`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_ledger_entries_kind_occurred` ON `market_ledger_entries` (`kind`,`occurred_on`);
