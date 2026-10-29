CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `click_events` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`sub_link_id` text,
	`country` text DEFAULT 'XX' NOT NULL,
	`city` text,
	`device` text DEFAULT 'desktop' NOT NULL,
	`os` text DEFAULT 'Other' NOT NULL,
	`browser` text DEFAULT 'Other' NOT NULL,
	`referrer` text DEFAULT 'Direct' NOT NULL,
	`query_param_ref` text,
	`clicked_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_click_events_link_time` ON `click_events` (`link_id`,`clicked_at`);--> statement-breakpoint
CREATE INDEX `idx_click_events_global_time` ON `click_events` (`clicked_at`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text DEFAULT 'DIRECT' NOT NULL,
	`destination_url` text,
	`redirect_status` integer DEFAULT 307 NOT NULL,
	`forward_query_params` integer DEFAULT true NOT NULL,
	`hub_links_json` text,
	`title` text NOT NULL,
	`description` text,
	`og_image_url` text,
	`category` text DEFAULT 'project' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`icon` text DEFAULT 'link' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`expires_at` integer,
	`max_clicks` integer,
	`clicks_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `check_links_type` CHECK (`type` IN ('DIRECT', 'HUB')),
	CONSTRAINT `check_links_redirect_status` CHECK (`redirect_status` IN (301, 302, 307, 308)),
	CONSTRAINT `check_links_slug_lower` CHECK (`slug` = lower(`slug`) AND length(`slug`) BETWEEN 3 AND 100),
	CONSTRAINT `check_links_direct_destination` CHECK (`type` != 'DIRECT' OR (`destination_url` IS NOT NULL AND length(trim(`destination_url`)) > 0)),
	CONSTRAINT `check_links_clicks_count` CHECK (`clicks_count` >= 0),
	CONSTRAINT `check_links_max_clicks` CHECK (`max_clicks` IS NULL OR `max_clicks` > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_links_slug_unique` ON `links` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_links_admin_cursor` ON `links` (`is_pinned`,`id`);--> statement-breakpoint
CREATE INDEX `idx_links_public_cursor` ON `links` (`is_public`,`is_active`,`is_pinned`,`id`);--> statement-breakpoint
CREATE INDEX `idx_links_category` ON `links` (`category`,`is_pinned`,`id`);--> statement-breakpoint
CREATE TABLE `pin_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`attempts_count` integer DEFAULT 1 NOT NULL,
	`window_expires_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
