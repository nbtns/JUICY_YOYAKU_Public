import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function migratedDatabase(beforeMigration = null) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrations = (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const migration of migrations) {
    beforeMigration?.(database, migration);
    const sql = await readFile(new URL(`../drizzle/${migration}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
  }
  return database;
}

test("過去のNG解除履歴だけを削除する", async () => {
  const database = await migratedDatabase((current, migration) => {
    if (migration !== "0004_remove_calendar_block_release_logs.sql") return;
    current.prepare("INSERT INTO audit_logs (id, action, entity_type, entity_id, created_at) VALUES ('release-log', 'calendar_block_deleted', 'calendar_block', 'block-1', 1), ('create-log', 'calendar_block_created', 'calendar_block', 'block-1', 1)").run();
  });
  assert.equal(database.prepare("SELECT count(*) AS count FROM audit_logs WHERE action = 'calendar_block_deleted'").get().count, 0);
  assert.equal(database.prepare("SELECT count(*) AS count FROM audit_logs WHERE action = 'calendar_block_created'").get().count, 1);
});

function insertTrial(database, id, startsAt) {
  const endsAt = startsAt + 60 * 60_000;
  database.prepare("INSERT INTO trial_bookings (id, reference, student_name, birth_date, email, phone, starts_at, ends_at, status, duplicate_candidate, privacy_consent_at, cancellation_consent_at, created_at, updated_at) VALUES (?, ?, '試験 生徒', '2000-01-01', 'test@example.com', '09000000000', ?, ?, 'confirmed', 0, 1, 1, 1, 1)").run(id, `REF-${id}`, startsAt, endsAt);
}

test("予約トリガーが重複を拒否し、連続する1時間枠を許可する", async () => {
  const database = await migratedDatabase();
  const start = new Date("2026-08-08T10:00:00+09:00").getTime();
  insertTrial(database, "first", start);
  assert.throws(() => insertTrial(database, "overlap", start + 30 * 60_000), /reservation_conflict/);
  assert.doesNotThrow(() => insertTrial(database, "allowed", start + 60 * 60_000));
});

function seedMember(database, suffix = "1", granted = 4) {
  database.prepare("INSERT INTO accounts (id, email, role, status, created_at, updated_at) VALUES (?, ?, 'member', 'active', 1, 1)").run(`account-${suffix}`, `member-${suffix}@example.com`);
  database.prepare("INSERT INTO students (id, account_id, name, birth_date, email, phone, created_at, updated_at) VALUES (?, ?, ?, '2000-01-01', ?, '09000000000', 1, 1)").run(`student-${suffix}`, `account-${suffix}`, `生徒${suffix}`, `member-${suffix}@example.com`);
  database.prepare("INSERT INTO contracts (id, student_id, lesson_type, course, starts_on, status, created_at, updated_at) VALUES (?, ?, 'individual', 'monthly4', '2026-08-01', 'active', 1, 1)").run(`contract-${suffix}`, `student-${suffix}`);
  database.prepare("INSERT INTO monthly_credits (id, contract_id, month, granted, reserved, completed, forfeited, expired, provisional, created_at, updated_at) VALUES (?, ?, '2026-08', ?, 0, 0, 0, 0, 0, 1, 1)").run(`credit-${suffix}`, `contract-${suffix}`, granted);
}

function insertMemberBooking(database, suffix, startsAt, studentSuffix = "1") {
  const id = `booking-${suffix}`;
  database.prepare("INSERT INTO bookings (id, student_id, representative_student_id, starts_at, ends_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'confirmed', 1, 1)").run(id, `student-${studentSuffix}`, `student-${studentSuffix}`, startsAt, startsAt + 60 * 60_000);
  database.prepare("INSERT INTO booking_students (booking_id, student_id, monthly_credit_id, attendance_status) VALUES (?, ?, ?, 'reserved')").run(id, `student-${studentSuffix}`, `credit-${studentSuffix}`);
  return id;
}

test("会員予約の確定と連絡ありキャンセルで残り回数が3回、4回へ変わる", async () => {
  const database = await migratedDatabase();
  seedMember(database);
  const bookingId = insertMemberBooking(database, "cancel", new Date("2026-08-08T14:00:00+09:00").getTime());
  assert.deepEqual({ ...database.prepare("SELECT reserved, completed, forfeited FROM monthly_credits WHERE id = 'credit-1'").get() }, { reserved: 1, completed: 0, forfeited: 0 });
  database.prepare("UPDATE bookings SET status = 'cancelled_on_time' WHERE id = ?").run(bookingId);
  assert.deepEqual({ ...database.prepare("SELECT reserved, completed, forfeited FROM monthly_credits WHERE id = 'credit-1'").get() }, { reserved: 0, completed: 0, forfeited: 0 });
  assert.equal(database.prepare("SELECT count(*) AS count FROM credit_events WHERE booking_id = ?").get(bookingId).count, 2);
});

test("受講完了はcompletedへ、無断キャンセルはforfeitedへ1回移す", async () => {
  const database = await migratedDatabase();
  seedMember(database);
  const completedId = insertMemberBooking(database, "complete", new Date("2026-08-08T10:00:00+09:00").getTime());
  database.prepare("UPDATE bookings SET status = 'completed' WHERE id = ?").run(completedId);
  const noShowId = insertMemberBooking(database, "no-show", new Date("2026-08-08T12:30:00+09:00").getTime());
  database.prepare("UPDATE bookings SET status = 'no_show' WHERE id = ?").run(noShowId);
  assert.deepEqual({ ...database.prepare("SELECT reserved, completed, forfeited FROM monthly_credits WHERE id = 'credit-1'").get() }, { reserved: 0, completed: 1, forfeited: 1 });
});

test("先生都合の休講は予約回数を返し翌月末期限の振替を発行する", async () => {
  const database = await migratedDatabase();
  seedMember(database);
  const bookingId = insertMemberBooking(database, "teacher", new Date("2026-08-08T16:00:00+09:00").getTime());
  database.prepare("UPDATE bookings SET status = 'teacher_cancelled' WHERE id = ?").run(bookingId);
  assert.equal(database.prepare("SELECT reserved FROM monthly_credits WHERE id = 'credit-1'").get().reserved, 0);
  assert.deepEqual({ ...database.prepare("SELECT student_id, source_booking_id, expires_on, status FROM makeup_credits WHERE source_booking_id = ?").get(bookingId) }, { student_id: "student-1", source_booking_id: bookingId, expires_on: "2026-09-30", status: "available" });
});

test("回数不足の参加者がいるグループ予約は全体をロールバックできる", async () => {
  const database = await migratedDatabase();
  seedMember(database, "1", 4);
  seedMember(database, "2", 0);
  database.prepare("INSERT INTO groups (id, name, representative_student_id, status, created_at, updated_at) VALUES ('group-1', '試験グループ', 'student-1', 'active', 1, 1)").run();
  database.prepare("INSERT INTO group_members (group_id, student_id, joined_at) VALUES ('group-1', 'student-1', 1), ('group-1', 'student-2', 1)").run();
  const start = new Date("2026-08-10T10:00:00+09:00").getTime();
  assert.throws(() => {
    database.exec("BEGIN");
    try {
      database.prepare("INSERT INTO bookings (id, group_id, representative_student_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('group-booking', 'group-1', 'student-1', ?, ?, 'confirmed', 1, 1)").run(start, start + 60 * 60_000);
      database.prepare("INSERT INTO booking_students (booking_id, student_id, monthly_credit_id) VALUES ('group-booking', 'student-1', 'credit-1')").run();
      database.prepare("INSERT INTO booking_students (booking_id, student_id, monthly_credit_id) VALUES ('group-booking', 'student-2', 'credit-2')").run();
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  }, /credit_unavailable/);
  assert.equal(database.prepare("SELECT count(*) AS count FROM bookings WHERE id = 'group-booking'").get().count, 0);
  assert.equal(database.prepare("SELECT reserved FROM monthly_credits WHERE id = 'credit-1'").get().reserved, 0);
});

test("予約不可時間との重複と日時変更時の二重予約をデータベースで拒否する", async () => {
  const database = await migratedDatabase();
  const blockedStart = new Date("2026-08-12T14:00:00+09:00").getTime();
  database.prepare("INSERT INTO calendar_blocks (id, kind, starts_at, ends_at, reason, created_at, updated_at) VALUES ('block', 'single', ?, ?, '休業', 1, 1)").run(blockedStart, blockedStart + 60 * 60_000);
  assert.throws(() => insertTrial(database, "blocked", blockedStart), /calendar_block_conflict/);
  const first = new Date("2026-08-13T10:00:00+09:00").getTime();
  const second = new Date("2026-08-13T13:00:00+09:00").getTime();
  insertTrial(database, "move-first", first);
  insertTrial(database, "move-second", second);
  assert.throws(() => database.prepare("UPDATE trial_bookings SET starts_at = ?, ends_at = ? WHERE id = 'move-second'").run(first + 30 * 60_000, first + 90 * 60_000), /reservation_conflict/);
});

test("同じ操作キーはデータベースで1件だけ受け付ける", async () => {
  const database = await migratedDatabase();
  database.prepare("INSERT INTO idempotency_requests (actor_key, scope, idempotency_key, created_at) VALUES ('actor', 'create', 'same-key', 1)").run();
  assert.throws(() => database.prepare("INSERT INTO idempotency_requests (actor_key, scope, idempotency_key, created_at) VALUES ('actor', 'create', 'same-key', 2)").run(), /UNIQUE constraint/);
});

test("キャンセルした枠は再予約できる", async () => {
  const database = await migratedDatabase();
  const start = new Date("2026-08-08T14:00:00+09:00").getTime();
  insertTrial(database, "cancelled", start);
  database.prepare("UPDATE trial_bookings SET status = 'cancelled' WHERE id = 'cancelled'").run();
  assert.doesNotThrow(() => insertTrial(database, "replacement", start));
});
