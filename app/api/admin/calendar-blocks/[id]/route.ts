import { env } from "cloudflare:workers";
import { requireAdminActor } from "@/lib/auth";
import { safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const startsAt = Date.parse(normalizeText(body.startsAt, 40));
    const endsAt = Date.parse(normalizeText(body.endsAt, 40));
    const reason = normalizeText(body.reason, 500);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt || !reason) return jsonError("日時と理由を確認してください");
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE calendar_blocks SET starts_at = ?, ends_at = ?, reason = ?, updated_at = ? WHERE id = ?").bind(startsAt, endsAt, reason, now, id),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, after_json, reason, created_at) VALUES (?, ?, 'calendar_block_updated', 'calendar_block', ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.accountId, id, JSON.stringify({ startsAt, endsAt }), reason, now),
    ]);
    return Response.json({ id, startsAt, endsAt, reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("calendar_block_conflict")) return jsonError("この時間には予約があるため変更できません", 409);
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminActor(request)) return jsonError("管理者権限が必要です", 403);
  const { id } = await context.params;
  await env.DB.prepare("DELETE FROM calendar_blocks WHERE id = ?").bind(id).run();
  return Response.json({ id, released: true });
}
