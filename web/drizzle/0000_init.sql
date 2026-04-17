CREATE TABLE `farms` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farms_name_idx` ON `farms` (`name`);
--> statement-breakpoint
CREATE TABLE `fields` (
  `id` text PRIMARY KEY NOT NULL,
  `farm_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `fields_farm_idx` ON `fields` (`farm_id`);
--> statement-breakpoint
CREATE TABLE `analyses` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `image_sha256` text NOT NULL,
  `source` text DEFAULT 'upload' NOT NULL,
  `field_id` text NOT NULL,
  `pest_type` text DEFAULT 'nao_identificado' NOT NULL,
  `severity` text NOT NULL,
  `severity_label_pt` text NOT NULL,
  `affected_pct` real NOT NULL,
  `leaf_pixels` integer NOT NULL,
  `diseased_pixels` integer NOT NULL,
  `original_path` text,
  `annotated_path` text,
  `thumbnail_path` text,
  `warnings` text,
  `captured_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `analyses_field_captured_idx` ON `analyses` (`field_id`,`captured_at`);
--> statement-breakpoint
CREATE INDEX `analyses_captured_idx` ON `analyses` (`captured_at`);
--> statement-breakpoint
CREATE INDEX `analyses_severity_idx` ON `analyses` (`severity`);
--> statement-breakpoint
CREATE INDEX `analyses_pest_captured_idx` ON `analyses` (`pest_type`,`captured_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_sha_idx` ON `analyses` (`image_sha256`);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_request_idx` ON `analyses` (`request_id`);
--> statement-breakpoint
CREATE TABLE `recommendations` (
  `id` text PRIMARY KEY NOT NULL,
  `analysis_id` text NOT NULL,
  `content` text NOT NULL,
  `model` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recommendations_analysis_idx` ON `recommendations` (`analysis_id`);
--> statement-breakpoint
CREATE TABLE `llm_cache` (
  `key` text PRIMARY KEY NOT NULL,
  `text` text NOT NULL,
  `model` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `ip_hash` text NOT NULL,
  `ua_hash` text NOT NULL,
  `sha256` text NOT NULL,
  `bytes` integer NOT NULL,
  `sniffed_mime` text NOT NULL,
  `result` text NOT NULL,
  `error_code` text,
  `created_at` integer NOT NULL
);
