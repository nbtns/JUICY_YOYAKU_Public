import { env } from "cloudflare:workers";
import { safePublicError, ReservationError } from "@/lib/reservation-engine";
import { verifiedTrial } from "@/lib/trial-access";
import { jsonError, normalizeText } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const trial = await verifiedTrial(reference, normalizeText(body.token, 160));
    if (trial.status === "cancelled") return Response.json({ reference, status: "cancelled", replayed: true });
    if (trial.status !== "confirmed") throw new ReservationError("この予約はすでに処理済みです", 409, "invalid_transition");
    const reason = normalizeText(body.reason, 500);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE trial_bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(now, trial.id),
      env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, reason, created_at) VALUES (?, ?, 'trial', 'cancelled_by_member', ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), trial.id, JSON.stringify({ status: trial.status }), JSON.stringify({ status: "cancelled" }), reason || null, now),
    ]);
    return Response.json({ reference, status: "cancelled" });
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
