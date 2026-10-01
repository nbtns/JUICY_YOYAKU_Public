import { env } from "cloudflare:workers";
import { safePublicError, validatedRange } from "@/lib/reservation-engine";
import { jsonError, normalizeEmail, normalizePhone, normalizeText, isIsoDate } from "@/lib/validation";
import { sendEmail, trialConfirmationEmail } from "@/lib/email";

type TrialPayload = Record<string, unknown>;

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return jsonError("JSON形式で送信してください", 415);
  const body = await request.json() as TrialPayload;
  if (typeof body.email !== "string" || !body.email.endsWith("@example.com") || body.phone !== "09000000000") return jsonError("デモ用のメール（@example.com）と電話番号（09000000000）を使ってください");
  if (normalizeText(body.website, 200)) return Response.json({ message: "お申し込みを受け付けました", reference: "JUICY-REVIEW" });

  const studentName = normalizeText(body.studentName, 80);
  const birthDate = normalizeText(body.birthDate, 10);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const date = normalizeText(body.date, 10);
  const time = normalizeText(body.time, 5);
  const idempotencyKey = normalizeText(request.headers.get("idempotency-key") ?? body.idempotencyKey, 120);
  if (!studentName || !email || !phone || !isIsoDate(birthDate) || !isIsoDate(date)) return jsonError("必須項目を確認してください");
  if (body.privacyConsent !== "agreed" || body.cancellationConsent !== "agreed") return jsonError("規約への同意が必要です");
  if (idempotencyKey.length < 8) return jsonError("操作キーが正しくありません");

  let range;
  try { range = validatedRange(date, time); } catch (error) { const safe = safePublicError(error); return jsonError(safe.message, safe.status); }

  const reference = `JUICY-${date.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const id = crypto.randomUUID();
  const manageToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const manageTokenHash = await sha256(manageToken);
  const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const clientHash = await sha256(`${clientAddress}:${String(env.RATE_LIMIT_SALT ?? "juicy-trial")}`);
  const actorKey = `trial:${clientHash}`;
  const now = Date.now();
  const db = env.DB;

  try {
    const replay = await db.prepare("SELECT response_json FROM idempotency_requests WHERE actor_key = ? AND scope = 'trial_create' AND idempotency_key = ?")
      .bind(actorKey, idempotencyKey).first<{ response_json: string | null }>();
    if (replay?.response_json) return Response.json({ ...JSON.parse(replay.response_json), replayed: true });
    const recent = await db.prepare("SELECT count(*) AS count FROM rate_limit_events WHERE action = 'trial_create' AND client_hash = ? AND created_at >= ?")
      .bind(clientHash, now - 60 * 60_000).first<{ count: number }>();
    if ((recent?.count ?? 0) >= 5) return jsonError("短時間に多くのお申し込みがありました。1時間ほど待ってからお試しください", 429);
    const duplicate = await db.prepare("SELECT 1 FROM trial_bookings WHERE student_name = ? AND birth_date = ? AND phone = ? LIMIT 1").bind(studentName, birthDate, phone).first();
    const replayResponse = { message: "無料体験のお申し込みを受け付けました。", reference };
    await db.batch([
      db.prepare("INSERT INTO idempotency_requests (actor_key, scope, idempotency_key, entity_id, response_json, created_at) VALUES (?, 'trial_create', ?, ?, ?, ?)").bind(actorKey, idempotencyKey, id, JSON.stringify(replayResponse), now),
      db.prepare(`INSERT INTO trial_bookings (id, reference, student_name, birth_date, email, phone, experience, instrument, desired_song, notes, guardian_name, guardian_contact, starts_at, ends_at, status, duplicate_candidate, privacy_consent_at, cancellation_consent_at, manage_token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)`)
        .bind(id, reference, studentName, birthDate, email, phone, normalizeText(body.experience, 30), normalizeText(body.instrument, 30), normalizeText(body.song, 160), normalizeText(body.notes, 1000), normalizeText(body.guardianName, 80) || null, normalizeText(body.guardianContact, 254) || null, range.start.getTime(), range.end.getTime(), duplicate ? 1 : 0, now, now, manageTokenHash, now, now),
      db.prepare("INSERT INTO booking_events (id, booking_id, booking_type, event_type, after_json, created_at) VALUES (?, ?, 'trial', 'created', ?, ?)").bind(crypto.randomUUID(), id, JSON.stringify({ startsAt: range.start.getTime(), endsAt: range.end.getTime(), status: "confirmed" }), now),
      db.prepare("INSERT INTO rate_limit_events (id, action, client_hash, created_at) VALUES (?, 'trial_create', ?, ?)").bind(crypto.randomUUID(), clientHash, now),
    ]);

    const manageUrl = `${new URL(request.url).origin}/trial/manage/${encodeURIComponent(reference)}?token=${encodeURIComponent(manageToken)}`;
    const emailTemplate = trialConfirmationEmail(studentName, date, time, reference, manageUrl);
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let providerId: string | null = null;
    let emailError: string | null = null;
    try {
      const result = await sendEmail({ to: email, ...emailTemplate });
      emailStatus = result.status;
      providerId = result.status === "sent" ? result.id : null;
      emailError = result.status === "skipped" ? result.reason : null;
    } catch (emailSendError) {
      emailStatus = "failed";
      emailError = emailSendError instanceof Error ? emailSendError.message : "送信失敗";
    }
    await db.prepare("INSERT INTO notification_logs (id, channel, type, recipient, subject, status, provider_id, error, sent_at, created_at, updated_at) VALUES (?, 'email', 'trial_confirmation', ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), email, emailTemplate.subject, emailStatus === "sent" ? "sent" : "failed", providerId, emailError, emailStatus === "sent" ? now : null, now, now).run();
    const message = emailStatus === "sent" ? "無料体験のお申し込みを受け付けました。確認メールをご確認ください。" : "無料体験のお申し込みを受け付けました。デモ内に保存しました。メール送信は行いません。";
    return Response.json({ message, reference, manageToken }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("reservation_conflict") || message.includes("calendar_block_conflict") || message.includes("reservation_slots.starts_at")) return jsonError("選択した時間は埋まりました。別の時間をお選びください", 409);
    if (message.includes("idempotency_requests") && message.includes("UNIQUE")) return jsonError("同じ操作を処理中です。少し待ってから予約状況をご確認ください", 409);
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
