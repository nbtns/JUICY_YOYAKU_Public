import { env } from "cloudflare:workers";
import { demoRole, demoEmail } from "./demo";

export type ActorRole = "member" | "guardian" | "admin";

export type AuthorizedActor = {
  accountId: string | null;
  email: string;
  role: ActorRole;
  previewStudentId?: string;
};

function adminAllowlist() { return new Set(["teacher@example.com"]); }

export async function authorizedActor(request: Request): Promise<AuthorizedActor | null> {
  const role = demoRole(request.headers.get("cookie"));
  if (!role) return null;
  const email = demoEmail(role);

  if (adminAllowlist().has(email)) {
    const account = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = ? AND status = 'active' LIMIT 1").bind(email).first<{ id: string }>();
    return { accountId: account?.id ?? null, email, role: "admin" };
  }

  const account = await env.DB.prepare("SELECT id, role FROM accounts WHERE lower(email) = ? AND status = 'active' LIMIT 1")
    .bind(email).first<{ id: string; role: ActorRole }>();
  return account ? { accountId: account.id, email, role: account.role } : null;
}

export async function requireMemberActor(request: Request) {
  const actor = await authorizedActor(request);
  if (!actor) return null;
  if (actor.role !== "admin") return actor;
  const previewStudentId = new URL(request.url).searchParams.get("preview")?.trim() ?? "";
  if (!previewStudentId) return null;
  const student = await env.DB.prepare("SELECT s.id FROM students s JOIN contracts c ON c.student_id = s.id AND c.status = 'active' WHERE s.id = ? LIMIT 1").bind(previewStudentId).first<{ id: string }>();
  if (!student) return null;
  // 先生の会員プレビューは、選択した1人だけを操作できる保護者相当の権限に絞る。
  return { ...actor, role: "guardian" as const, previewStudentId: student.id };
}

export async function requireAdminActor(request: Request) {
  const actor = await authorizedActor(request);
  return actor?.role === "admin" ? actor : null;
}

export async function accessibleStudentIds(actor: AuthorizedActor) {
  if (actor.previewStudentId) return [actor.previewStudentId];
  if (!actor.accountId) return [];
  if (actor.role === "member") {
    const result = await env.DB.prepare("SELECT id FROM students WHERE account_id = ? ORDER BY name").bind(actor.accountId).all<{ id: string }>();
    return result.results.map((row) => row.id);
  }
  if (actor.role === "guardian") {
    const result = await env.DB.prepare("SELECT gs.student_id AS id FROM guardians g JOIN guardian_students gs ON gs.guardian_id = g.id WHERE g.account_id = ? ORDER BY gs.student_id")
      .bind(actor.accountId).all<{ id: string }>();
    return result.results.map((row) => row.id);
  }
  const result = await env.DB.prepare("SELECT id FROM students ORDER BY name").all<{ id: string }>();
  return result.results.map((row) => row.id);
}

export function actorCanAccessStudent(actor: AuthorizedActor, allowedStudentIds: string[], studentId: string) {
  return actor.role === "admin" || allowedStudentIds.includes(studentId);
}
