import { env } from "cloudflare:workers";
import { requireAdminActor } from "@/lib/auth";
import { ReservationError, safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

const statusByAction = { cancel: "cancelled", complete: "completed", "no-show": "no_show" } as const;

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const { id, action } = await context.params;
    const status = statusByAction[action as keyof typeof statusByAction];
    if (!status) throw new ReservationError("操作が正しくありません", 404, "not_found");
    const body = await request.json() as Record<string, unknown>;
    const reason = normalizeText(body.reason, 500);
    if (!reason) throw new ReservationError("管理操作には理由を入力してください");
    const trial = await env.DB.prepare("SELECT id, status FROM trial_bookings WHERE id = ?").bind(id).first<{ id: string; status: string }>();
    if (!trial) throw new ReservationError("予約が見つかりません", 404, "not_found");
    if (trial.status === status) return Response.json({ id, status, replayed: true });
    if (trial.status !== "confirmed") throw new ReservationError("この予約はすでに処理済みです", 409, "invalid_transition");
    const eventType = status === "completed" ? "completed" : status === "no_show" ? "no_show" : "cancelled_by_member";
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE trial_bookings SET status = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(status, now, id),
      env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, reason, actor_account_id, created_at) VALUES (?, ?, 'trial', ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, eventType, JSON.stringify({ status: trial.status }), JSON.stringify({ status }), reason, actor.accountId, now),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, before_json, after_json, reason, created_at) VALUES (?, ?, ?, 'trial_booking', ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.accountId, eventType, id, JSON.stringify({ status: trial.status }), JSON.stringify({ status }), reason, now),
    ]);
    return Response.json({ id, status });
  } catch (error) {
    const safe = safePublicError(error); return jsonError(safe.message, safe.status);
  }
}
