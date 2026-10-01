import { env } from "cloudflare:workers";
import { requireAdminActor } from "@/lib/auth";
import { jsonError, normalizeEmail, normalizePhone, normalizeText, isIsoDate } from "@/lib/validation";

const grants = { monthly3: 3, monthly4: 4, monthly8: 8 } as const;

export async function GET(request: Request) {
  if (!await requireAdminActor(request)) return jsonError("管理者権限が必要です", 403);
  const members = await env.DB.prepare("SELECT s.id, s.name, s.email, c.course, c.lesson_type, c.status FROM students s LEFT JOIN contracts c ON c.student_id = s.id ORDER BY s.created_at DESC LIMIT 200").all();
  return Response.json({ members: members.results }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireAdminActor(request);
  if (!actor) return jsonError("管理者権限が必要です", 403);
  const body = await request.json() as Record<string, unknown>;
  if (typeof body.email !== "string" || !body.email.endsWith("@example.com") || body.phone !== "09000000000") return jsonError("デモ用のメール（@example.com）と電話番号（09000000000）を使ってください");
  const name = normalizeText(body.name, 80);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const birthDate = normalizeText(body.birthDate, 10);
  const course = normalizeText(body.course, 20) as keyof typeof grants;
  const lessonType = "individual";
  if (!name || !email || !phone || !isIsoDate(birthDate) || !grants[course]) return jsonError("会員情報を確認してください");
  const accountId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const contractId = crypto.randomUUID();
  const creditId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const now = Date.now();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date());
  const startsOn = `${month}-01`;
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO accounts (id, email, role, status, created_at, updated_at) VALUES (?, ?, 'member', 'active', ?, ?)").bind(accountId, email, now, now),
      env.DB.prepare("INSERT INTO students (id, account_id, name, birth_date, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(studentId, accountId, name, birthDate, email, phone, now, now),
      env.DB.prepare("INSERT INTO contracts (id, student_id, lesson_type, course, starts_on, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)").bind(contractId, studentId, lessonType, course, startsOn, now, now),
      env.DB.prepare("INSERT INTO monthly_credits (id, contract_id, month, granted, reserved, completed, forfeited, expired, provisional, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)").bind(creditId, contractId, month, grants[course], now, now),
      env.DB.prepare("INSERT INTO credit_events (id, monthly_credit_id, student_id, event_type, reason, actor_account_id, idempotency_key, created_at) VALUES (?, ?, ?, 'grant', '会員登録時の月回数付与', ?, ?, ?)").bind(crypto.randomUUID(), creditId, studentId, actor.accountId, `initial-grant:${creditId}`, now),
      env.DB.prepare("INSERT INTO payments (id, contract_id, month, amount, status, created_at, updated_at) VALUES (?, ?, ?, 0, 'active', ?, ?)").bind(paymentId, contractId, month, now, now),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_account_id, action, entity_type, entity_id, after_json, reason, created_at) VALUES (?, ?, 'member_created', 'student', ?, ?, '管理画面から会員登録', ?)").bind(crypto.randomUUID(), actor.accountId, studentId, JSON.stringify({ name, email, course, lessonType }), now),
    ]);
    return Response.json({ id: studentId, name, email, course, lessonType, granted: grants[course] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("accounts.email") || message.includes("accounts_email_unique")) return jsonError("このメールアドレスは登録済みです", 409);
    return jsonError("会員を登録できませんでした", 500);
  }
}
