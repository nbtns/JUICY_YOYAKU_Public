DROP TRIGGER trial_booking_no_overlap;
--> statement-breakpoint
DROP TRIGGER booking_no_overlap;
--> statement-breakpoint
DROP TRIGGER trial_booking_reschedule_guard;
--> statement-breakpoint
DROP TRIGGER booking_reschedule_guard;
--> statement-breakpoint
CREATE TRIGGER trial_booking_no_overlap
BEFORE INSERT ON trial_bookings
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM reservation_slots
  WHERE active = 1
    AND NEW.starts_at < ends_at
    AND starts_at < NEW.ends_at
)
BEGIN
  SELECT RAISE(ABORT, 'reservation_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER booking_no_overlap
BEFORE INSERT ON bookings
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM reservation_slots
  WHERE active = 1
    AND NEW.starts_at < ends_at
    AND starts_at < NEW.ends_at
)
BEGIN
  SELECT RAISE(ABORT, 'reservation_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_reschedule_guard
BEFORE UPDATE OF starts_at, ends_at ON trial_bookings
WHEN NEW.status = 'confirmed' AND (
  EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NOT (owner_type = 'trial' AND owner_id = NEW.id) AND NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
  OR EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
)
BEGIN SELECT RAISE(ABORT, 'reservation_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER booking_reschedule_guard
BEFORE UPDATE OF starts_at, ends_at ON bookings
WHEN NEW.status = 'confirmed' AND (
  EXISTS (SELECT 1 FROM reservation_slots WHERE active = 1 AND NOT (owner_type = 'booking' AND owner_id = NEW.id) AND NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
  OR EXISTS (SELECT 1 FROM calendar_blocks WHERE NEW.starts_at < ends_at AND starts_at < NEW.ends_at)
)
BEGIN SELECT RAISE(ABORT, 'reservation_conflict'); END;
