CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `booking_students` (
	`booking_id` text NOT NULL,
	`student_id` text NOT NULL,
	`monthly_credit_id` text,
	`makeup_credit_id` text,
	`attendance_status` text DEFAULT 'reserved' NOT NULL,
	PRIMARY KEY(`booking_id`, `student_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`monthly_credit_id`) REFERENCES `monthly_credits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`makeup_credit_id`) REFERENCES `makeup_credits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text,
	`group_id` text,
	`representative_student_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`representative_student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookings_starts_idx` ON `bookings` (`starts_at`);--> statement-breakpoint
CREATE INDEX `bookings_student_idx` ON `bookings` (`student_id`);--> statement-breakpoint
CREATE INDEX `bookings_group_idx` ON `bookings` (`group_id`);--> statement-breakpoint
CREATE TABLE `calendar_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`recurrence_rule` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_blocks_time_idx` ON `calendar_blocks` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `cash_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`kind` text NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_on` text NOT NULL,
	`handled_by_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`lesson_type` text NOT NULL,
	`group_id` text,
	`course` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contracts_student_idx` ON `contracts` (`student_id`);--> statement-breakpoint
CREATE INDEX `contracts_status_idx` ON `contracts` (`status`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`student_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `student_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`representative_student_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`representative_student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guardian_students` (
	`guardian_id` text NOT NULL,
	`student_id` text NOT NULL,
	PRIMARY KEY(`guardian_id`, `student_id`),
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `makeup_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`source_booking_id` text NOT NULL,
	`expires_on` text NOT NULL,
	`used_booking_id` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monthly_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`month` text NOT NULL,
	`granted` integer NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`forfeited` integer DEFAULT 0 NOT NULL,
	`expired` integer DEFAULT 0 NOT NULL,
	`provisional` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_credits_contract_month_unique` ON `monthly_credits` (`contract_id`,`month`);--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`type` text NOT NULL,
	`recipient` text,
	`subject` text,
	`status` text NOT NULL,
	`provider_id` text,
	`error` text,
	`scheduled_for` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_status_idx` ON `notification_logs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`square_customer_id` text,
	`square_subscription_id` text,
	`square_invoice_id` text,
	`failed_at` integer,
	`grace_ends_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_contract_month_idx` ON `payments` (`contract_id`,`month`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`type` text NOT NULL,
	`requested_at` integer NOT NULL,
	`effective_month` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`square_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_account_id` text,
	FOREIGN KEY (`updated_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`experience` text,
	`instrument` text,
	`desired_songs` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `students_account_idx` ON `students` (`account_id`);--> statement-breakpoint
CREATE INDEX `students_identity_idx` ON `students` (`name`,`birth_date`,`phone`);--> statement-breakpoint
CREATE TABLE `trial_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`student_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`experience` text,
	`instrument` text,
	`desired_song` text,
	`notes` text,
	`guardian_name` text,
	`guardian_contact` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`duplicate_candidate` integer DEFAULT false NOT NULL,
	`privacy_consent_at` integer NOT NULL,
	`cancellation_consent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_reference_unique` ON `trial_bookings` (`reference`);--> statement-breakpoint
CREATE INDEX `trial_starts_at_idx` ON `trial_bookings` (`starts_at`);--> statement-breakpoint
CREATE INDEX `trial_identity_idx` ON `trial_bookings` (`student_name`,`birth_date`,`phone`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`payload_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_provider_event_unique` ON `webhook_events` (`provider`,`id`);