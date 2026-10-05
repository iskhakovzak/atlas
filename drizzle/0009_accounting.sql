CREATE TABLE `market_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`amount_uzs` integer NOT NULL,
	`original_amount` real,
	`original_currency` text,
	`occurred_on` text NOT NULL,
	`order_id` text,
	`counterparty` text,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`voided_at` integer,
	`voided_by` text,
	`void_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_market_ledger_entries_occurred` ON `market_ledger_entries` (`occurred_on`);--> statement-breakpoint
CREATE INDEX `idx_market_ledger_entries_order` ON `market_ledger_entries` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_market_ledger_entries_kind` ON `market_ledger_entries` (`kind`);--> statement-breakpoint
CREATE TABLE `market_order_finance` (
	`order_id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`month` text,
	`goods` integer NOT NULL,
	`store_shipping` integer NOT NULL,
	`reserve` integer NOT NULL,
	`payable` integer NOT NULL,
	`commission` integer NOT NULL,
	`delivery` integer NOT NULL,
	`fx_gain` integer NOT NULL,
	`services` integer NOT NULL,
	`revenue` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_order_finance_month` ON `market_order_finance` (`month`);--> statement-breakpoint
CREATE INDEX `idx_market_order_finance_customer` ON `market_order_finance` (`customer_id`);