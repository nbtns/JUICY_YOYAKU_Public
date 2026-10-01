CREATE TRIGGER trial_booking_no_overlap
BEFORE INSERT ON trial_bookings
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM reservation_slots
  WHERE active = 1
    AND NEW.ends_at + 900000 > starts_at
    AND ends_at + 900000 > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'reservation_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_reserve_slot
AFTER INSERT ON trial_bookings
WHEN NEW.status = 'confirmed'
BEGIN
  INSERT INTO reservation_slots (starts_at, ends_at, owner_type, owner_id, active, created_at)
  VALUES (NEW.starts_at, NEW.ends_at, 'trial', NEW.id, 1, NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER booking_no_overlap
BEFORE INSERT ON bookings
WHEN NEW.status = 'confirmed' AND EXISTS (
  SELECT 1 FROM reservation_slots
  WHERE active = 1
    AND NEW.ends_at + 900000 > starts_at
    AND ends_at + 900000 > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'reservation_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER booking_reserve_slot
AFTER INSERT ON bookings
WHEN NEW.status = 'confirmed'
BEGIN
  INSERT INTO reservation_slots (starts_at, ends_at, owner_type, owner_id, active, created_at)
  VALUES (NEW.starts_at, NEW.ends_at, 'booking', NEW.id, 1, NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER trial_booking_release_slot
AFTER UPDATE OF status ON trial_bookings
WHEN OLD.status = 'confirmed' AND NEW.status <> 'confirmed'
BEGIN
  DELETE FROM reservation_slots WHERE owner_type = 'trial' AND owner_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER booking_release_slot
AFTER UPDATE OF status ON bookings
WHEN OLD.status = 'confirmed' AND NEW.status <> 'confirmed'
BEGIN
  DELETE FROM reservation_slots WHERE owner_type = 'booking' AND owner_id = NEW.id;
END;
