import { env } from "cloudflare:workers";
import { accessibleStudentIds, requireAdminActor } from "@/lib/auth";
import { createMemberBooking, safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function GET(request: Request) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date(Date.now() + 35 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const start = new Date(`${from}T00:00:00+09:00`).getTime();
  const end = new Date(`${to}T23:59:59.999+09:00`).getTime();
  const result = await env.DB.prepare(`SELECT id, 'trial' AS booking_type, starts_at, ends_at, status, student_name AS display_name, 'individual' AS lesson_type, 1 AS participant_count, duplicate_candidate AS attention_required
    FROM trial_bookings WHERE starts_at BETWEEN ? AND ?
    UNION ALL
    SELECT b.id, 'member' AS booking_type, b.starts_at, b.ends_at, b.status,
      CASE WHEN b.group_id IS NULL THEN s.name ELSE g.name END AS display_name,
      CASE WHEN b.group_id IS NULL THEN 'individual' ELSE 'group' END AS lesson_type,
      (SELECT count(*) FROM booking_students bs WHERE bs.booking_id = b.id) AS participant_count, 0 AS attention_required
    FROM bookings b LEFT JOIN students s ON s.id = b.student_id LEFT JOIN groups g ON g.id = b.group_id
    WHERE b.starts_at BETWEEN ? AND ? ORDER BY starts_at`).bind(start, end, start, end).all();
  return Response.json({ from, to, reservations: result.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await createMemberBooking({
      actor,
      allowedStudentIds: await accessibleStudentIds(actor),
      studentId: normalizeText(body.studentId, 80),
      groupId: normalizeText(body.groupId, 80) || null,
      date: normalizeText(body.date, 10),
      time: normalizeText(body.time, 5),
      idempotencyKey: normalizeText(request.headers.get("idempotency-key") ?? body.idempotencyKey, 120),
    });
    return Response.json(result, { status: "replayed" in result ? 200 : 201 });
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
