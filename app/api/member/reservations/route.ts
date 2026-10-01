import { env } from "cloudflare:workers";
import { accessibleStudentIds, requireMemberActor } from "@/lib/auth";
import { createMemberBooking, safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function GET(request: Request) {
  const actor = await requireMemberActor(request);
  if (!actor) return jsonError("ログインが必要です", 401);
  const studentIds = await accessibleStudentIds(actor);
  if (studentIds.length === 0) return Response.json({ reservations: [] }, { headers: { "cache-control": "no-store" } });
  const placeholders = studentIds.map(() => "?").join(",");
  const result = await env.DB.prepare(`SELECT DISTINCT b.id, b.starts_at, b.ends_at, b.status, b.group_id,
      CASE WHEN b.group_id IS NULL THEN s.name ELSE g.name END AS display_name,
      CASE WHEN b.group_id IS NULL THEN 'individual' ELSE 'group' END AS lesson_type,
      (SELECT count(*) FROM booking_students count_bs WHERE count_bs.booking_id = b.id) AS participant_count
    FROM bookings b JOIN booking_students bs ON bs.booking_id = b.id
    JOIN students s ON s.id = bs.student_id LEFT JOIN groups g ON g.id = b.group_id
    WHERE bs.student_id IN (${placeholders}) ORDER BY b.starts_at DESC LIMIT 100`).bind(...studentIds).all();
  return Response.json({ reservations: result.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireMemberActor(request);
  if (!actor) return jsonError("ログインが必要です", 401);
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
