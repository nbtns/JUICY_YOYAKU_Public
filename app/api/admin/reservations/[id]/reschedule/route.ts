import { accessibleStudentIds, requireAdminActor } from "@/lib/auth";
import { rescheduleBooking, safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const reason = normalizeText(body.reason, 500);
    if (!reason) return jsonError("変更理由を入力してください");
    return Response.json(await rescheduleBooking({ bookingId: id, actor, allowedStudentIds: await accessibleStudentIds(actor), date: normalizeText(body.date, 10), time: normalizeText(body.time, 5), reason }));
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
