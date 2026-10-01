import { env } from "cloudflare:workers";
import { requireAdminActor } from "@/lib/auth";
import { safePublicError } from "@/lib/reservation-engine";
import { jsonError, normalizeText } from "@/lib/validation";

export async function GET(request: Request) {
  if (!await requireAdminActor(request)) return jsonError("管理者権限が必要です", 403);
  const blocks = await env.DB.prepare("SELECT id, kind, starts_at, ends_at, reason FROM calendar_blocks ORDER BY starts_at DESC LIMIT 200").all();
  return Response.json({ blocks: blocks.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const reason = normalizeText(body.reason, 500) || "予約不可時間";
    const requestedRanges = Array.isArray(body.ranges) ? body.ranges : [body];
    if (requestedRanges.length === 0 || requestedRanges.length > 100) return jsonError("日時を確認してください");
    const ranges = requestedRanges.map((value) => {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return { id: crypto.randomUUID(), startsAt: Date.parse(normalizeText(item.startsAt, 40)), endsAt: Date.parse(normalizeText(item.endsAt, 40)) };
    });
    if (ranges.some((range) => !Number.isFinite(range.startsAt) || !Number.isFinite(range.endsAt) || range.startsAt >= range.endsAt)) return jsonError("日時を確認してください");
    const now = Date.now();
    await env.DB.batch(ranges.flatMap((range) => [
      env.DB.prepare("INSERT INTO calendar_blocks (id, kind, starts_at, ends_at, reason, created_at, updated_at) VALUES (?, 'single', ?, ?, ?, ?, ?)").bind(range.id, range.startsAt, range.endsAt, reason, now, now),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, after_json, reason, created_at) VALUES (?, ?, 'calendar_block_created', 'calendar_block', ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.accountId, range.id, JSON.stringify({ startsAt: range.startsAt, endsAt: range.endsAt }), reason, now),
    ]));
    return Response.json({ blocks: ranges.map((range) => ({ ...range, reason })) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("calendar_block_conflict")) return jsonError("この時間には予約があるため、予約不可時間にできません", 409);
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
