CREATE TABLE `market_identity_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`confirmed_data` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
