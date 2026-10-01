import { env } from "cloudflare:workers";
import { requireAdminActor } from "@/lib/auth";
import { ReservationError, safePublicError, validatedRange } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const reason = normalizeText(body.reason, 500);
    if (!reason) throw new ReservationError("変更理由を入力してください");
    const trial = await env.DB.prepare("SELECT id, status, starts_at, ends_at FROM trial_bookings WHERE id = ?").bind(id).first<{ id: string; status: string; starts_at: number; ends_at: number }>();
    if (!trial) throw new ReservationError("予約が見つかりません", 404, "not_found");
    if (trial.status !== "confirmed") throw new ReservationError("確定中の予約だけ日時を変更できます", 409, "invalid_transition");
    const range = validatedRange(normalizeText(body.date, 10), normalizeText(body.time, 5));
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE trial_bookings SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(range.start.getTime(), range.end.getTime(), now, id),
      env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, reason, actor_account_id, created_at) VALUES (?, ?, 'trial', 'rescheduled', ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, JSON.stringify({ startsAt: trial.starts_at, endsAt: trial.ends_at }), JSON.stringify({ startsAt: range.start.getTime(), endsAt: range.end.getTime() }), reason, actor.accountId, now),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, before_json, after_json, reason, created_at) VALUES (?, ?, 'rescheduled', 'trial_booking', ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.accountId, id, JSON.stringify({ startsAt: trial.starts_at, endsAt: trial.ends_at }), JSON.stringify({ startsAt: range.start.getTime(), endsAt: range.end.getTime() }), reason, now),
    ]);
    return Response.json({ id, status: "confirmed", startsAt: range.start.toISOString(), endsAt: range.end.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("reservation_conflict") || message.includes("calendar_block_conflict") || message.includes("UNIQUE constraint")) return jsonError("選択した時間は埋まりました。別の時間をお選びください", 409);
    const safe = safePublicError(error); return jsonError(safe.message, safe.status);
  }
}
