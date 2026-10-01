CREATE TABLE `reservation_slots` (
	`starts_at` integer PRIMARY KEY NOT NULL,
	`ends_at` integer NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reservation_slots_owner_idx` ON `reservation_slots` (`owner_type`,`owner_id`);