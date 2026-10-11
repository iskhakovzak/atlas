CREATE INDEX IF NOT EXISTS `idx_market_provider_jobs_status` ON `market_provider_jobs` (`provider`,`status`,`created_at`);
