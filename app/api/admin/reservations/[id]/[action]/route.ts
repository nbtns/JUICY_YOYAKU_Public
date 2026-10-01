import { accessibleStudentIds, requireAdminActor } from "@/lib/auth";
import { safePublicError, transitionBooking } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

const statusByAction = { cancel: "cancelled_on_time", complete: "completed", "no-show": "no_show", "teacher-cancel": "teacher_cancelled" } as const;

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const { id, action } = await context.params;
    const status = statusByAction[action as keyof typeof statusByAction];
    if (!status) return jsonError("操作が正しくありません", 404);
    const body = await request.json() as Record<string, unknown>;
    const reason = normalizeText(body.reason, 500);
    if (!reason) return jsonError("管理操作には理由を入力してください");
    return Response.json(await transitionBooking({ bookingId: id, actor, allowedStudentIds: await accessibleStudentIds(actor), status, reason }));
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
