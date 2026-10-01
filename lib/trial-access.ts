import { env } from "cloudflare:workers";
import { ReservationError } from "./reservation-engine.ts";

export async function hashReservationToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifiedTrial(reference: string, token: string) {
  if (!reference || token.length < 32) throw new ReservationError("確認用リンクが正しくありません", 401, "invalid_token");
  const tokenHash = await hashReservationToken(token);
  const trial = await env.DB.prepare("SELECT id, reference, student_name, starts_at, ends_at, status FROM trial_bookings WHERE reference = ? AND manage_token_hash = ?")
    .bind(reference, tokenHash).first<{ id: string; reference: string; student_name: string; starts_at: number; ends_at: number; status: string }>();
  if (!trial) throw new ReservationError("予約を確認できません。確認メールのリンクをもう一度お使いください", 401, "invalid_token");
  return trial;
}
