import { accessibleStudentIds, requireMemberActor } from "@/lib/auth";
import { rescheduleBooking, safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireMemberActor(request);
  if (!actor) return jsonError("ログインが必要です", 401);
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    return Response.json(await rescheduleBooking({ bookingId: id, actor, allowedStudentIds: await accessibleStudentIds(actor), date: normalizeText(body.date, 10), time: normalizeText(body.time, 5), reason: "会員による日時変更" }));
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
