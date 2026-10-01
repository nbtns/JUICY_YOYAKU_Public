import { env } from "cloudflare:workers";
import { safePublicError, validatedRange, ReservationError } from "@/lib/reservation-engine";
import { verifiedTrial } from "@/lib/trial-access";
import { jsonError, normalizeText } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const trial = await verifiedTrial(reference, normalizeText(body.token, 160));
    if (trial.status !== "confirmed") throw new ReservationError("確定中の予約だけ日時を変更できます", 409, "invalid_transition");
    const range = validatedRange(normalizeText(body.date, 10), normalizeText(body.time, 5));
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE trial_bookings SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(range.start.getTime(), range.end.getTime(), now, trial.id),
      env.DB.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, before_json, after_json, created_at) VALUES (?, ?, 'trial', 'rescheduled', ?, ?, ?)")
        .bind(crypto.randomUUID(), trial.id, JSON.stringify({ startsAt: trial.starts_at, endsAt: trial.ends_at }), JSON.stringify({ startsAt: range.start.getTime(), endsAt: range.end.getTime() }), now),
    ]);
    return Response.json({ reference, status: "confirmed", startsAt: range.start.toISOString(), endsAt: range.end.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("reservation_conflict") || message.includes("calendar_block_conflict") || message.includes("UNIQUE constraint")) return jsonError("選択した時間は埋まりました。別の時間をお選びください", 409);
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
