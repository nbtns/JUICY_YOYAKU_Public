const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const tokyoDate = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function buildDemoSeedSql(now = new Date()) {
  const nowMs = now.getTime();
  const date = tokyoDate(now);
  const month = date.slice(0, 7);
  const firstMonth = month + "-01";
  const [year, monthNumber] = month.split("-").map(Number);
  const months = Array.from({ length: 3 }, (_, index) => tokyoDate(new Date(Date.UTC(year, monthNumber - 1 + index, 1))).slice(0, 7));
  const rows = [
    "PRAGMA foreign_keys = ON;",
    "INSERT OR IGNORE INTO accounts (id, email, role, status, created_at, updated_at) VALUES ('demo-teacher', 'teacher@example.com', 'admin', 'active', " + nowMs + ", " + nowMs + ");",
  ];
  for (const [suffix, email, name] of [["member", "member@example.com", "デモ会員 あおい"], ["other", "other@example.com", "デモ会員 はる"]]) {
    rows.push("INSERT OR IGNORE INTO accounts (id, email, role, status, created_at, updated_at) VALUES (" + quote("demo-" + suffix) + ", " + quote(email) + ", 'member', 'active', " + nowMs + ", " + nowMs + ");");
    rows.push("INSERT OR IGNORE INTO students (id, account_id, name, birth_date, email, phone, experience, instrument, desired_songs, created_at, updated_at) VALUES (" + quote("student-" + suffix) + ", " + quote("demo-" + suffix) + ", " + quote(name) + ", '2000-01-01', " + quote(email) + ", '09000000000', 'beginner', 'acoustic', '好きな一曲', " + nowMs + ", " + nowMs + ");");
    rows.push("INSERT OR IGNORE INTO contracts (id, student_id, lesson_type, course, starts_on, status, created_at, updated_at) VALUES (" + quote("contract-" + suffix) + ", " + quote("student-" + suffix) + ", 'individual', 'monthly4', " + quote(firstMonth) + ", 'active', " + nowMs + ", " + nowMs + ");");
    for (const grantMonth of months) {
      rows.push("INSERT OR IGNORE INTO monthly_credits (id, contract_id, month, granted, reserved, completed, forfeited, expired, provisional, created_at, updated_at) VALUES (" + quote("credit-" + suffix + "-" + grantMonth) + ", " + quote("contract-" + suffix) + ", " + quote(grantMonth) + ", 4, 0, 0, 0, 0, 0, " + nowMs + ", " + nowMs + ");");
      rows.push("INSERT OR IGNORE INTO payments (id, contract_id, month, amount, status, created_at, updated_at) VALUES (" + quote("payment-" + suffix + "-" + grantMonth) + ", " + quote("contract-" + suffix) + ", " + quote(grantMonth) + ", 0, 'active', " + nowMs + ", " + nowMs + ");");
    }
  }
  // Fixed demo IDs keep repeated setup from recreating cancelled or modified lessons.
  const tomorrow = tokyoDate(new Date(nowMs + 86400000));
  const lessonMonth = tomorrow.slice(0, 7);
  for (const [suffix, hour] of [["member", "15"], ["other", "16"]]) {
    const start = new Date(tomorrow + "T" + hour + ":00:00+09:00").getTime();
    rows.push("INSERT INTO bookings (id, student_id, representative_student_id, starts_at, ends_at, status, created_at, updated_at) SELECT " + quote("demo-booking-" + suffix) + ", " + quote("student-" + suffix) + ", " + quote("student-" + suffix) + ", " + start + ", " + (start + 3600000) + ", 'confirmed', " + nowMs + ", " + nowMs + " WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE id = " + quote("demo-booking-" + suffix) + ");");
    rows.push("INSERT OR IGNORE INTO booking_students (booking_id, student_id, monthly_credit_id, attendance_status) SELECT " + quote("demo-booking-" + suffix) + ", " + quote("student-" + suffix) + ", " + quote("credit-" + suffix + "-" + lessonMonth) + ", 'reserved' WHERE NOT EXISTS (SELECT 1 FROM booking_students WHERE booking_id = " + quote("demo-booking-" + suffix) + ");");
  }
  return rows.join("\n") + "\n";
}
