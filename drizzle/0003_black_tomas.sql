CREATE TABLE `booking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`booking_type` text NOT NULL,
	`event_type` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`actor_account_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_idx` ON `booking_events` (`booking_type`,`booking_id`);--> statement-breakpoint
CREATE TABLE `credit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`monthly_credit_id` text,
	`student_id` text NOT NULL,
	`booking_id` text,
	`event_type` text NOT NULL,
	`delta_reserved` integer DEFAULT 0 NOT NULL,
	`delta_completed` integer DEFAULT 0 NOT NULL,
	`delta_forfeited` integer DEFAULT 0 NOT NULL,
	`delta_expired` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`actor_account_id` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monthly_credit_id`) REFERENCES `monthly_credits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_events_idempotency_unique` ON `credit_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `credit_events_booking_idx` ON `credit_events` (`booking_id`);--> statement-breakpoint
CREATE TABLE `idempotency_requests` (
	`actor_key` text NOT NULL,
	`scope` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`entity_id` text,
	`response_json` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`actor_key`, `scope`, `idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`client_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_lookup_idx` ON `rate_limit_events` (`action`,`client_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `trial_bookings` ADD `manage_token_hash` text;
--> statement-breakpoint
CREATE TRIGGER monthly_credit_nonnegative
BEFORE UPDATE OF granted, reserved, completed, forfeited, expired ON monthly_credits
WHEN NEW.granted < 0 OR NEW.reserved < 0 OR NEW.completed < 0 OR NEW.forfeited < 0 OR NEW.expired < 0
  OR NEW.reserved + NEW.completed + NEW.forfeited + NEW.expired > NEW.granted
BEGIN SELECT RAISE(ABORT, 'invalid_credit_balance'); END;
--> statement-breakpoint
CREATE TRIGGER booking_student_credit_available
BEFORE INSERT ON booking_students
WHEN NEW.monthly_credit_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM monthly_credits WHERE id = NEW.monthly_credit_id AND granted - reserved - completed - forfeited - expired > 0
)
BEGIN SELECT RAISE(ABORT, 'credit_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_student_makeup_available
BEFORE INSERT ON booking_students
WHEN NEW.makeup_credit_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM makeup_credits WHERE id = NEW.makeup_credit_id AND student_id = NEW.student_id AND status = 'available' AND expires_on >= date('now', '+9 hours')
)
BEGIN SELECT RAISE(ABORT, 'credit_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_student_reserve_credit
AFTER INSERT ON booking_students
BEGIN
  UPDATE monthly_credits SET reserved = reserved + 1, updated_at = unixepoch('subsec') * 1000 WHERE id = NEW.monthly_credit_id;
  UPDATE makeup_credits SET status = 'reserved', used_booking_id = NEW.booking_id, updated_at = unixepoch('subsec') * 1000 WHERE id = NEW.makeup_credit_id;
  INSERT INTO credit_events (id, monthly_credit_id, student_id, booking_id, event_type, delta_reserved, delta_completed, delta_forfeited, delta_expired, reason, idempotency_key, created_at)
  SELECT lower(hex(randomblob(16))), NEW.monthly_credit_id, NEW.student_id, NEW.booking_id, 'reserve', 1, 0, 0, 0, '予約確定', 'reserve:' || NEW.booking_id || ':' || NEW.student_id, unixepoch('subsec') * 1000
  WHERE NEW.monthly_credit_id IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_blocked_time
BEFORE INSERT ON trial_bookings
WHEN NEW.status = 'confirmed' AND EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
BEGIN SELECT RAISE(ABORT, 'calendar_block_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER booking_blocked_time
BEFORE INSERT ON bookings
WHEN NEW.status = 'confirmed' AND EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
BEGIN SELECT RAISE(ABORT, 'calendar_block_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_reschedule_guard
BEFORE UPDATE OF starts_at, ends_at ON trial_bookings
WHEN NEW.status = 'confirmed' AND (
  EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NOT (owner_type = 'trial' AND owner_id = NEW.id) AND NEW.ends_at + 900000 > starts_at AND ends_at + 900000 > NEW.starts_at)
  OR EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
)
BEGIN SELECT RAISE(ABORT, 'reservation_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER booking_reschedule_guard
BEFORE UPDATE OF starts_at, ends_at ON bookings
WHEN NEW.status = 'confirmed' AND (
  EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NOT (owner_type = 'booking' AND owner_id = NEW.id) AND NEW.ends_at + 900000 > starts_at AND ends_at + 900000 > NEW.starts_at)
  OR EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
)
BEGIN SELECT RAISE(ABORT, 'reservation_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_reschedule_slot
AFTER UPDATE OF starts_at, ends_at ON trial_bookings
WHEN NEW.status = 'confirmed'
BEGIN UPDATE reservation_slots SET starts_at = NEW.starts_at, ends_at = NEW.ends_at WHERE owner_type = 'trial' AND owner_id = NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER booking_reschedule_slot
AFTER UPDATE OF starts_at, ends_at ON bookings
WHEN NEW.status = 'confirmed'
BEGIN UPDATE reservation_slots SET starts_at = NEW.starts_at, ends_at = NEW.ends_at WHERE owner_type = 'booking' AND owner_id = NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER booking_status_transition_guard
BEFORE UPDATE OF status ON bookings
WHEN OLD.status <> NEW.status AND OLD.status <> 'confirmed'
BEGIN SELECT RAISE(ABORT, 'invalid_booking_transition'); END;
--> statement-breakpoint
CREATE TRIGGER booking_status_apply_credits
AFTER UPDATE OF status ON bookings
WHEN OLD.status = 'confirmed' AND NEW.status <> 'confirmed'
BEGIN
  UPDATE monthly_credits SET reserved = reserved - 1,
    completed = completed + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    forfeited = forfeited + CASE WHEN NEW.status IN ('no_show', 'cancelled_late') THEN 1 ELSE 0 END,
    updated_at = unixepoch('subsec') * 1000
  WHERE id IN (SELECT monthly_credit_id FROM booking_students WHERE booking_id = NEW.id AND monthly_credit_id IS NOT NULL);
  UPDATE makeup_credits SET
    status = CASE WHEN NEW.status IN ('cancelled_on_time', 'teacher_cancelled') THEN 'available' ELSE 'used' END,
    used_booking_id = CASE WHEN NEW.status IN ('cancelled_on_time', 'teacher_cancelled') THEN NULL ELSE NEW.id END,
    updated_at = unixepoch('subsec') * 1000
  WHERE id IN (SELECT makeup_credit_id FROM booking_students WHERE booking_id = NEW.id AND makeup_credit_id IS NOT NULL);
  UPDATE booking_students SET attendance_status = CASE NEW.status
    WHEN 'completed' THEN 'attended' WHEN 'cancelled_on_time' THEN 'cancelled_on_time' WHEN 'cancelled_late' THEN 'cancelled_late'
    WHEN 'no_show' THEN 'no_show' WHEN 'teacher_cancelled' THEN 'cancelled_on_time' ELSE attendance_status END
  WHERE booking_id = NEW.id;
  INSERT INTO credit_events (id, monthly_credit_id, student_id, booking_id, event_type, delta_reserved, delta_completed, delta_forfeited, delta_expired, reason, idempotency_key, created_at)
  SELECT lower(hex(randomblob(16))), monthly_credit_id, student_id, NEW.id,
    CASE WHEN NEW.status = 'completed' THEN 'complete' WHEN NEW.status IN ('no_show', 'cancelled_late') THEN 'forfeit' ELSE 'release' END,
    -1, CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END, CASE WHEN NEW.status IN ('no_show', 'cancelled_late') THEN 1 ELSE 0 END, 0,
    CASE WHEN NEW.status = 'teacher_cancelled' THEN '先生都合の休講' WHEN NEW.status = 'completed' THEN '受講完了' WHEN NEW.status IN ('no_show', 'cancelled_late') THEN '無断キャンセル' ELSE '連絡ありキャンセル' END,
    'status:' || NEW.id || ':' || student_id || ':' || NEW.status, unixepoch('subsec') * 1000
  FROM booking_students WHERE booking_id = NEW.id AND monthly_credit_id IS NOT NULL;
  INSERT INTO makeup_credits (id, student_id, source_booking_id, expires_on, status, created_at, updated_at)
  SELECT lower(hex(randomblob(16))), student_id, NEW.id, date(NEW.starts_at / 1000, 'unixepoch', '+9 hours', 'start of month', '+2 months', '-1 day'), 'available', unixepoch('subsec') * 1000, unixepoch('subsec') * 1000
  FROM booking_students WHERE booking_id = NEW.id AND NEW.status = 'teacher_cancelled';
END;
--> statement-breakpoint
CREATE TRIGGER calendar_block_insert_guard
BEFORE INSERT ON calendar_blocks
WHEN EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
BEGIN SELECT RAISE(ABORT, 'calendar_block_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER calendar_block_update_guard
BEFORE UPDATE OF starts_at, ends_at ON calendar_blocks
WHEN EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
BEGIN SELECT RAISE(ABORT, 'calendar_block_conflict'); END;
