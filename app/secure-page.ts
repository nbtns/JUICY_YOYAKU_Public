import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireDemoUser } from "./demo-auth";

function adminEmails() { return new Set(["teacher@example.com"]); }

export async function requireMemberPage(returnTo: string) {
  const user = await requireDemoUser(returnTo);
  const account = await env.DB.prepare("SELECT role, status FROM accounts WHERE lower(email) = ? LIMIT 1").bind(user.email.toLowerCase()).first<{ role: string; status: string }>();
  const isAdmin = adminEmails().has(user.email.toLowerCase()) || (account?.status === "active" && account.role === "admin");
  if (isAdmin) {
    const previewStudentId = new URL(`https://preview.local${returnTo}`).searchParams.get("preview");
    const student = previewStudentId
      ? await env.DB.prepare("SELECT s.id, s.name FROM students s JOIN contracts c ON c.student_id = s.id AND c.status = 'active' WHERE s.id = ? LIMIT 1").bind(previewStudentId).first<{ id: string; name: string }>()
      : await env.DB.prepare("SELECT s.id, s.name FROM students s JOIN contracts c ON c.student_id = s.id AND c.status = 'active' ORDER BY s.created_at DESC LIMIT 1").first<{ id: string; name: string }>();
    if (!student) redirect("/admin?access=preview-not-found#test-members");
    return { ...user, isAdminPreview: true, previewStudentId: student.id, previewStudentName: student.name };
  }
  if (!account || account.status !== "active" || !["member", "guardian"].includes(account.role)) redirect("/?access=member-required");
  return { ...user, isAdminPreview: false, previewStudentId: null, previewStudentName: null };
}

export async function requireAdminPage(returnTo: string) {
  const user = await requireDemoUser(returnTo);
  if (adminEmails().has(user.email.toLowerCase())) return user;
  const account = await env.DB.prepare("SELECT role, status FROM accounts WHERE lower(email) = ? LIMIT 1").bind(user.email.toLowerCase()).first<{ role: string; status: string }>();
  if (!account || account.status !== "active" || account.role !== "admin") redirect("/?access=admin-required");
  return user;
}
