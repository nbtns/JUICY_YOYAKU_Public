import { sendEmailWithRuntime } from "./email";

type ScheduledEnv = { DB: D1Database; RESEND_API_KEY?: string; EMAIL_FROM?: string };

function tokyoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")), hour: Number(value("hour")), minute: Number(value("minute")) };
}

function monthKey(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}`; }

export async function runScheduledJobs(env: ScheduledEnv, scheduledTime: number) {
  const now = new Date(scheduledTime);
  const tokyo = tokyoParts(now);
  const nowMs = now.getTime();
  if (tokyo.day === 21 && tokyo.hour === 9 && tokyo.minute < 15) {
    const next = new Date(Date.UTC(tokyo.year, tokyo.month, 1));
    const nextMonth = monthKey(next.getUTCFullYear(), next.getUTCMonth() + 1);
    await env.DB.prepare(`INSERT OR IGNORE INTO monthly_credits (id, contract_id, month, granted, reserved, completed, forfeited, expired, provisional, created_at, updated_at) SELECT lower(hex(randomblob(16))), id, ?, CASE course WHEN 'monthly3' THEN 3 WHEN 'monthly4' THEN 4 WHEN 'monthly8' THEN 8 ELSE 0 END, 0, 0, 0, 0, 1, ?, ? FROM contracts WHERE status = 'active' AND course <> 'flex'`).bind(nextMonth, nowMs, nowMs).run();
    await env.DB.prepare(`INSERT OR IGNORE INTO credit_events (id, monthly_credit_id, student_id, event_type, reason, idempotency_key, created_at) SELECT lower(hex(randomblob(16))), mc.id, c.student_id, 'grant', '翌月回数の定期付与', 'grant:' || mc.id, ? FROM monthly_credits mc JOIN contracts c ON c.id = mc.contract_id WHERE mc.month = ?`).bind(nowMs, nextMonth).run();
  }
  if (tokyo.day === 1 && tokyo.hour === 0 && tokyo.minute < 15) {
    const previous = new Date(Date.UTC(tokyo.year, tokyo.month - 2, 1));
    const previousMonth = monthKey(previous.getUTCFullYear(), previous.getUTCMonth() + 1);
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO credit_events (id, monthly_credit_id, student_id, event_type, delta_expired, reason, idempotency_key, created_at) SELECT lower(hex(randomblob(16))), mc.id, c.student_id, 'expire', mc.granted - mc.reserved - mc.completed - mc.forfeited - mc.expired, '月末失効', 'expire:' || mc.id, ? FROM monthly_credits mc JOIN contracts c ON c.id = mc.contract_id WHERE mc.month = ? AND mc.granted - mc.reserved - mc.completed - mc.forfeited - mc.expired > 0`).bind(nowMs, previousMonth),
      env.DB.prepare(`UPDATE monthly_credits SET expired = expired + (granted - reserved - completed - forfeited - expired), updated_at = ? WHERE month = ? AND granted - reserved - completed - forfeited - expired > 0`).bind(nowMs, previousMonth),
      env.DB.prepare("UPDATE makeup_credits SET status = 'expired', updated_at = ? WHERE status = 'available' AND expires_on < date(?, 'unixepoch', '+9 hours')").bind(nowMs, Math.floor(nowMs / 1000)),
    ]);
  }
  if (tokyo.day === 15 && tokyo.hour === 10 && tokyo.minute < 15) {
    const currentMonth = monthKey(tokyo.year, tokyo.month);
    await env.DB.prepare(`INSERT OR IGNORE INTO notification_logs (id, channel, type, recipient, subject, status, scheduled_for, created_at, updated_at) SELECT 'remaining-' || mc.id, 'email', 'remaining_credits', s.email, '【JUICY ギター教室】今月の残り回数のお知らせ', 'scheduled', ?, ?, ? FROM monthly_credits mc JOIN contracts c ON c.id = mc.contract_id JOIN students s ON s.id = c.student_id WHERE mc.month = ? AND (mc.granted - mc.reserved - mc.completed - mc.forfeited - mc.expired) >= 1`).bind(nowMs, nowMs, nowMs, currentMonth).run();
  }
  if (tokyo.hour === 18 && tokyo.minute < 15) {
    const tomorrowStart = new Date(nowMs + 24 * 60 * 60_000); tomorrowStart.setUTCHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60_000 - 1);
    await env.DB.prepare(`INSERT OR IGNORE INTO notification_logs (id, channel, type, recipient, subject, status, scheduled_for, created_at, updated_at) SELECT 'reminder-' || b.id || '-' || s.id, 'email', 'lesson_reminder', s.email, '【JUICY ギター教室】明日のレッスンのお知らせ', 'scheduled', ?, ?, ? FROM bookings b JOIN booking_students bs ON bs.booking_id = b.id JOIN students s ON s.id = bs.student_id WHERE b.status = 'confirmed' AND b.starts_at BETWEEN ? AND ?`).bind(nowMs, nowMs, nowMs, tomorrowStart.getTime(), tomorrowEnd.getTime()).run();
  }
  await env.DB.prepare("UPDATE payments SET status = 'review_required', updated_at = ? WHERE status IN ('failed', 'initial_pending') AND grace_ends_at IS NOT NULL AND grace_ends_at < ?").bind(nowMs, nowMs).run();
  const pending = await env.DB.prepare("SELECT id, recipient, subject FROM notification_logs WHERE status = 'scheduled' AND recipient IS NOT NULL AND scheduled_for <= ? ORDER BY scheduled_for LIMIT 20").bind(nowMs).all<{ id: string; recipient: string; subject: string }>();
  for (const notification of pending.results) {
    try {
      const sent = await sendEmailWithRuntime(env, { to: notification.recipient, subject: notification.subject, html: `<p>JUICY ギター教室からのお知らせです。</p><p>詳しい内容は予約ページでご確認ください。</p>` });
      await env.DB.prepare("UPDATE notification_logs SET status = ?, provider_id = ?, error = ?, sent_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'")
        .bind(sent.status === "sent" ? "sent" : "failed", sent.status === "sent" ? sent.id : null, sent.status === "skipped" ? sent.reason : null, sent.status === "sent" ? nowMs : null, nowMs, notification.id).run();
    } catch (error) {
      await env.DB.prepare("UPDATE notification_logs SET status = 'failed', error = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'").bind(error instanceof Error ? error.message.slice(0, 500) : "送信失敗", nowMs, notification.id).run();
    }
  }
}
