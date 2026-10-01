import { formatLessonTimeRange } from "./booking.ts";

type EmailMessage = { to: string; subject: string; html: string };
type EmailResult = { status: "sent"; id: string | null } | { status: "skipped"; reason: string };
type EmailEnv = { RESEND_API_KEY?: string; EMAIL_FROM?: string };

// Even if someone supplies credentials, this portfolio copy never sends email.
export async function sendEmail(message: EmailMessage) {
  return sendEmailWithRuntime({}, message);
}
export async function sendEmailWithRuntime(runtime: EmailEnv, message: EmailMessage): Promise<EmailResult> {
  void runtime; void message;
  return { status: "skipped" as const, reason: "制作実績用デモのため、メールは送信しません" };
}

export function trialConfirmationEmail(name: string, date: string, time: string, reference: string, manageUrl?: string) {
  return { subject: "【JUICY デモ】無料体験予約の確認",
    html: `<h1>${escapeHtml(name)}さま</h1><p>${escapeHtml(date)} ${escapeHtml(formatLessonTimeRange(time))}</p><p>受付番号: ${escapeHtml(reference)}</p>${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">予約の確認・日時変更・キャンセル</a></p>` : ""}` };
}
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
