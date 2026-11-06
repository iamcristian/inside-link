ALTER TABLE `links` ADD `og_mode` text DEFAULT 'auto' NOT NULL CHECK (og_mode IN ('auto', 'custom', 'minimal'));
--> statement-breakpoint
UPDATE links SET og_mode = 'custom' WHERE length(trim(og_image_url)) > 0;
