import { accessibleStudentIds, requireMemberActor } from "@/lib/auth";
import { safePublicError, transitionBooking } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireMemberActor(request);
  if (!actor) return jsonError("ログインが必要です", 401);
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    return Response.json(await transitionBooking({ bookingId: id, actor, allowedStudentIds: await accessibleStudentIds(actor), status: "cancelled_on_time", reason: normalizeText(body.reason, 500) || "会員から連絡あり" }));
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
