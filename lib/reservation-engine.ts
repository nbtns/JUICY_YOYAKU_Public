import { env } from "cloudflare:workers";
import { availableSlots, createDailySlots, slotAvailability, slotRange, type TimeRange } from "./booking.ts";
import { policy } from "./config.ts";
import { isIsoDate, normalizeText } from "./validation.ts";
import type { AuthorizedActor } from "./auth.ts";

export class ReservationError extends Error {
  constructor(message: string, public status = 400, public code = "invalid_request") {
    super(message);
  }
}

type TimeRow = { starts_at: number; ends_at: number };
type CreditRow = {
  student_id: string;
  student_name: string;
  student_email: string;
  contract_id: string;
  lesson_type: "individual" | "group";
  group_id: string | null;
  course: string;
  monthly_credit_id: string | null;
  makeup_credit_id: string | null;
  remaining: number | null;
  payment_status: string | null;
  grace_ends_at: number | null;
};

const DAY_MS = 24 * 60 * 60_000;

export function tokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function reservationDateAllowed(date: string, now = new Date()) {
  if (!isIsoDate(date)) return { allowed: false, reason: "日付を正しく指定してください" };
  const today = tokyoDateKey(now);
  if (date < today) return { allowed: false, reason: "過去の日付は選べません" };
  const todayMonth = today.slice(0, 7);
  const targetMonth = date.slice(0, 7);
  const currentMonthStart = new Date(`${todayMonth}-01T00:00:00+09:00`);
  const nextMonthDate = new Date(currentMonthStart.getTime());
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = tokyoDateKey(nextMonthDate).slice(0, 7);
  if (targetMonth !== todayMonth && targetMonth !== nextMonth) return { allowed: false, reason: "予約できるのは今月と翌月です" };
  if (targetMonth === nextMonth) {
    const releaseAt = new Date(`${todayMonth}-${String(policy.bookingReleaseDay).padStart(2, "0")}T${policy.bookingReleaseTime}:00+09:00`);
    if (now < releaseAt) return { allowed: false, reason: `翌月分は毎月${policy.bookingReleaseDay}日 ${policy.bookingReleaseTime}に受付開始します` };
  }
  return { allowed: true as const, reason: null };
}

export function validatedRange(date: string, time: string) {
  const allowed = reservationDateAllowed(date);
  if (!allowed.allowed) throw new ReservationError(allowed.reason, 400, "date_unavailable");
  if (!createDailySlots().includes(time)) throw new ReservationError("開始時刻を正しく指定してください");
  const range = slotRange(date, time);
  if (range.start.getTime() <= Date.now()) throw new ReservationError("未来の日時を選んでください");
  return range;
}

export async function availabilityForDate(date: string) {
  const allowed = reservationDateAllowed(date);
  if (!allowed.allowed) throw new ReservationError(allowed.reason, 400, "date_unavailable");
  const dayStart = new Date(`${date}T00:00:00+09:00`).getTime();
  const dayEnd = new Date(`${date}T23:59:59.999+09:00`).getTime();
  const [slotResult, blockResult] = await env.DB.batch([
    env.DB.prepare("SELECT starts_at, ends_at FROM reservation_slots WHERE active = 1 AND starts_at BETWEEN ? AND ?").bind(dayStart, dayEnd),
    env.DB.prepare("SELECT starts_at, ends_at FROM calendar_blocks WHERE starts_at <= ? AND ends_at >= ?").bind(dayEnd, dayStart),
  ]);
  const ranges = (rows: unknown[]): TimeRange[] => (rows as TimeRow[]).map((row) => ({ start: new Date(row.starts_at), end: new Date(row.ends_at) }));
  const existing = ranges(slotResult.results);
  const blocked = ranges(blockResult.results);
  return {
    date,
    slots: availableSlots(date, existing, blocked),
    schedule: slotAvailability(date, existing, blocked),
    businessHours: "10:00〜21:00",
    lessonMinutes: policy.lessonMinutes,
    bufferMinutes: policy.bufferMinutes,
  };
}

export async function idempotentResult(actorKey: string, scope: string, key: string) {
  if (!key || key.length < 8 || key.length > 120) throw new ReservationError("操作キーが正しくありません", 400, "invalid_idempotency_key");
  const row = await env.DB.prepare("SELECT response_json FROM idempotency_requests WHERE actor_key = ? AND scope = ? AND idempotency_key = ?")
    .bind(actorKey, scope, key).first<{ response_json: string | null }>();
  return row?.response_json ? JSON.parse(row.response_json) as Record<string, unknown> : null;
}

async function creditForStudent(studentId: string, date: string): Promise<CreditRow> {
  const row = await env.DB.prepare(`SELECT s.id AS student_id, s.name AS student_name, s.email AS student_email, c.id AS contract_id, c.lesson_type, c.group_id, c.course,
      mc.id AS monthly_credit_id,
      CASE WHEN mc.id IS NULL THEN NULL ELSE mc.granted - mc.reserved - mc.completed - mc.forfeited - mc.expired END AS remaining,
      (SELECT id FROM makeup_credits mk WHERE mk.student_id = s.id AND mk.status = 'available' AND mk.expires_on >= ? ORDER BY mk.expires_on LIMIT 1) AS makeup_credit_id,
      p.status AS payment_status, p.grace_ends_at
    FROM students s
    JOIN contracts c ON c.student_id = s.id AND c.status = 'active' AND c.starts_on <= ? AND (c.ends_on IS NULL OR c.ends_on >= ?)
    LEFT JOIN monthly_credits mc ON mc.contract_id = c.id AND mc.month = ?
    LEFT JOIN payments p ON p.contract_id = c.id AND p.month = ?
    WHERE s.id = ?
    ORDER BY c.created_at DESC LIMIT 1`)
    .bind(date, date, date, monthKey(date), monthKey(date), studentId).first<CreditRow>();
  if (!row) throw new ReservationError("有効な契約が見つかりません", 409, "contract_unavailable");
  if (["review_required", "paused", "cancelled"].includes(row.payment_status ?? "")) throw new ReservationError("お支払い状況の確認が必要なため、新しい予約を停止しています", 409, "payment_required");
  if (row.payment_status === "failed" && row.grace_ends_at && row.grace_ends_at <= Date.now()) throw new ReservationError("お支払いの猶予期間を過ぎているため、新しい予約を停止しています", 409, "payment_required");
  if (row.course === "flex") throw new ReservationError("フレックス予約は先生へお支払い方法をご確認ください", 409, "flex_requires_admin");
  if ((!row.monthly_credit_id || (row.remaining ?? 0) <= 0) && !row.makeup_credit_id) throw new ReservationError(`${row.student_name}さんの残り回数がありません`, 409, "credit_unavailable");
  return row;
}

async function resolveParticipantIds(actor: AuthorizedActor, allowedStudentIds: string[], requestedStudentId: string, requestedGroupId: string | null) {
  if (requestedGroupId) {
    const group = await env.DB.prepare("SELECT id, representative_student_id FROM groups WHERE id = ? AND status = 'active'").bind(requestedGroupId).first<{ id: string; representative_student_id: string }>();
    if (!group || (actor.role !== "admin" && !allowedStudentIds.includes(group.representative_student_id))) throw new ReservationError("このグループの予約を操作する権限がありません", 403, "forbidden");
    const members = await env.DB.prepare("SELECT student_id FROM group_members WHERE group_id = ? ORDER BY joined_at LIMIT 4").bind(requestedGroupId).all<{ student_id: string }>();
    if (members.results.length === 0 || members.results.length > 3) throw new ReservationError("グループ予約は1〜3人でご利用ください", 409, "invalid_group_size");
    return { studentIds: members.results.map((row) => row.student_id), groupId: requestedGroupId, representativeStudentId: group.representative_student_id };
  }
  if (actor.role !== "admin" && !allowedStudentIds.includes(requestedStudentId)) throw new ReservationError("この生徒の予約を操作する権限がありません", 403, "forbidden");
  return { studentIds: [requestedStudentId], groupId: null, representativeStudentId: requestedStudentId };
}

export async function createMemberBooking(input: {
  actor: AuthorizedActor;
  allowedStudentIds: string[];
  studentId: string;
  groupId?: string | null;
  date: string;
  time: string;
  idempotencyKey: string;
}) {
  const actorKey = input.actor.accountId ?? `admin:${input.actor.email}`;
  const scope = "member_booking_create";
  const previous = await idempotentResult(actorKey, scope, input.idempotencyKey);
  if (previous) return { ...previous, replayed: true };
  const range = validatedRange(input.date, input.time);
  const participants = await resolveParticipantIds(input.actor, input.allowedStudentIds, input.studentId, input.groupId ?? null);
  const credits = await Promise.all(participants.studentIds.map((studentId) => creditForStudent(studentId, input.date)));
  const bookingId = crypto.randomUUID();
  const now = Date.now();
  const response = { id: bookingId, status: "confirmed", startsAt: range.start.toISOString(), endsAt: range.end.toISOString(), remaining: credits.map((credit) => ({ studentId: credit.student_id, value: Math.max(0, (credit.remaining ?? 0) - (credit.makeup_credit_id ? 0 : 1)) })) };
  const statements = [
    env.DB.prepare("INSERT INTO idempotency_requests (actor_key, scope, idempotency_key, entity_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(actorKey, scope, input.idempotencyKey, bookingId, now),
    env.DB.prepare("INSERT INTO bookings (id, student_id, group_id, representative_student_id, starts_at, ends_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)")
      .bind(bookingId, participants.groupId ? null : participants.studentIds[0], participants.groupId, participants.representativeStudentId, range.start.getTime(), range.end.getTime(), now, now),
    ...credits.map((credit) => env.DB.prepare("INSERT INTO booking_students (booking_id, student_id, monthly_credit_id, makeup_credit_id, attendance_status) VALUES (?, ?, ?, ?, 'reserved')").bind(bookingId, credit.student_id, credit.makeup_credit_id ? null : credit.monthly_credit_id, credit.makeup_credit_id)),
    env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, after_json, actor_account_id, created_at) VALUES (?, ?, 'member', 'created', ?, ?, ?)")
      .bind(crypto.randomUUID(), bookingId, JSON.stringify(response), input.actor.accountId, now),
    ...credits.map((credit) => env.DB.prepare("INSERT INTO notification_logs (id, channel, type, recipient, subject, status, scheduled_for, created_at, updated_at) VALUES (?, 'email', 'member_booking_confirmation', ?, '【JUICY ギター教室】レッスン予約を確定しました', 'scheduled', ?, ?, ?)").bind(crypto.randomUUID(), credit.student_email, now, now, now)),
    env.DB.prepare("UPDATE idempotency_requests SET response_json = ? WHERE actor_key = ? AND scope = ? AND idempotency_key = ?").bind(JSON.stringify(response), actorKey, scope, input.idempotencyKey),
  ];
  try {
    await env.DB.batch(statements);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint") && message.includes("idempotency_requests")) {
      const replay = await idempotentResult(actorKey, scope, input.idempotencyKey);
      if (replay) return { ...replay, replayed: true };
    }
    if (message.includes("reservation_conflict") || message.includes("calendar_block_conflict") || message.includes("reservation_slots.starts_at")) throw new ReservationError("選択した時間は埋まりました。最新の空き時間から選び直してください", 409, "reservation_conflict");
    if (message.includes("credit_unavailable") || message.includes("invalid_credit_balance")) throw new ReservationError("残り回数が変わりました。画面を更新してご確認ください", 409, "credit_unavailable");
    throw error;
  }
}

export async function rescheduleBooking(input: { bookingId: string; actor: AuthorizedActor; allowedStudentIds: string[]; date: string; time: string; reason?: string }) {
  const booking = await ownedBooking(input.bookingId, input.actor, input.allowedStudentIds);
  if (booking.status !== "confirmed") throw new ReservationError("確定中の予約だけ日時を変更できます", 409, "invalid_transition");
  const range = validatedRange(input.date, input.time);
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE bookings SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(range.start.getTime(), range.end.getTime(), now, input.bookingId),
      env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, reason, actor_account_id, created_at) VALUES (?, ?, 'member', 'rescheduled', ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), input.bookingId, JSON.stringify({ startsAt: booking.starts_at, endsAt: booking.ends_at }), JSON.stringify({ startsAt: range.start.getTime(), endsAt: range.end.getTime() }), normalizeText(input.reason, 500) || null, input.actor.accountId, now),
      env.DB.prepare("INSERT INTO notification_logs (id, channel, type, recipient, subject, status, scheduled_for, created_at, updated_at) SELECT lower(hex(randomblob(16))), 'email', 'member_booking_rescheduled', s.email, '【JUICY ギター教室】レッスン日時を変更しました', 'scheduled', ?, ?, ? FROM booking_students bs JOIN students s ON s.id = bs.student_id WHERE bs.booking_id = ?").bind(now, now, now, input.bookingId),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("reservation_conflict") || message.includes("calendar_block_conflict") || message.includes("UNIQUE constraint")) throw new ReservationError("選択した時間は埋まりました。別の時間をお選びください", 409, "reservation_conflict");
    throw error;
  }
  return { id: input.bookingId, status: "confirmed", startsAt: range.start.toISOString(), endsAt: range.end.toISOString() };
}

type BookingOwnership = { id: string; status: string; starts_at: number; ends_at: number; representative_student_id: string | null };

export async function ownedBooking(bookingId: string, actor: AuthorizedActor, allowedStudentIds: string[]) {
  const booking = await env.DB.prepare("SELECT id, status, starts_at, ends_at, representative_student_id FROM bookings WHERE id = ?").bind(bookingId).first<BookingOwnership>();
  if (!booking) throw new ReservationError("予約が見つかりません", 404, "not_found");
  if (actor.role !== "admin") {
    const participants = await env.DB.prepare("SELECT student_id FROM booking_students WHERE booking_id = ?").bind(bookingId).all<{ student_id: string }>();
    const isRepresentative = booking.representative_student_id ? allowedStudentIds.includes(booking.representative_student_id) : false;
    const isParticipant = participants.results.some((row) => allowedStudentIds.includes(row.student_id));
    if (!isParticipant || (participants.results.length > 1 && !isRepresentative)) throw new ReservationError("この予約を操作する権限がありません", 403, "forbidden");
  }
  return booking;
}

export async function transitionBooking(input: { bookingId: string; actor: AuthorizedActor; allowedStudentIds: string[]; status: "cancelled_on_time" | "completed" | "no_show" | "teacher_cancelled"; reason: string }) {
  const booking = await ownedBooking(input.bookingId, input.actor, input.allowedStudentIds);
  if (booking.status === input.status) return { id: input.bookingId, status: input.status, replayed: true };
  if (booking.status !== "confirmed") throw new ReservationError("この予約はすでに処理済みです", 409, "invalid_transition");
  if (input.actor.role !== "admin" && input.status !== "cancelled_on_time") throw new ReservationError("この操作は先生だけが行えます", 403, "forbidden");
  const reason = normalizeText(input.reason, 500);
  if (input.actor.role === "admin" && !reason) throw new ReservationError("管理操作には理由を入力してください");
  const eventType = input.status === "completed" ? "completed" : input.status === "no_show" ? "no_show" : input.status === "teacher_cancelled" ? "cancelled_by_teacher" : "cancelled_by_member";
  const now = Date.now();
  const statements = [
    env.DB.prepare("UPDATE bookings SET status = ?, cancellation_reason = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(input.status, reason || null, now, input.bookingId),
    env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, reason, actor_account_id, created_at) VALUES (?, ?, 'member', ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), input.bookingId, eventType, JSON.stringify({ status: booking.status }), JSON.stringify({ status: input.status }), reason || null, input.actor.accountId, now),
    env.DB.prepare("INSERT INTO notification_logs (id, channel, type, recipient, subject, status, scheduled_for, created_at, updated_at) SELECT lower(hex(randomblob(16))), 'email', ?, s.email, ?, 'scheduled', ?, ?, ? FROM booking_students bs JOIN students s ON s.id = bs.student_id WHERE bs.booking_id = ?")
      .bind(`member_booking_${input.status}`, input.status === "teacher_cancelled" ? "【JUICY ギター教室】先生都合の休講と振替のお知らせ" : input.status === "completed" ? "【JUICY ギター教室】レッスン完了のお知らせ" : "【JUICY ギター教室】予約キャンセルのお知らせ", now, now, now, input.bookingId),
  ];
  if (input.actor.role === "admin") statements.push(env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, before_json, after_json, reason, created_at) VALUES (?, ?, ?, 'booking', ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), input.actor.accountId, eventType, input.bookingId, JSON.stringify({ status: booking.status }), JSON.stringify({ status: input.status }), reason, now));
  await env.DB.batch(statements);
  return { id: input.bookingId, status: input.status };
}

export function safePublicError(error: unknown) {
  if (error instanceof ReservationError) return { message: error.message, status: error.status, code: error.code };
  const message = error instanceof Error ? error.message : "";
  if (message.includes("no such table") || message.includes("no such column")) return { message: "予約データベースの更新中です。時間をおいてお試しください", status: 503, code: "database_unavailable" };
  return { message: "予約処理を完了できませんでした。時間をおいてお試しください", status: 500, code: "internal_error" };
}

export function rangesOverlapCandidate(date: string, time: string, rows: TimeRow[]) {
  const candidate = slotRange(date, time);
  return availableSlots(date, rows.map((row) => ({ start: new Date(row.starts_at), end: new Date(row.ends_at) }))).includes(time) && candidate.end.getTime() - candidate.start.getTime() === 60 * 60_000;
}

export { DAY_MS };
