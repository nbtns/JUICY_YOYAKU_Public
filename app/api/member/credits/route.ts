import { env } from "cloudflare:workers";
import { accessibleStudentIds, requireMemberActor } from "@/lib/auth";
import { jsonError } from "@/lib/validation";

export async function GET(request: Request) {
  const actor = await requireMemberActor(request);
  if (!actor) return jsonError("ログインが必要です", 401);
  const studentIds = await accessibleStudentIds(actor);
  if (studentIds.length === 0) return Response.json({ students: [] }, { headers: { "cache-control": "no-store" } });
  const placeholders = studentIds.map(() => "?").join(",");
  const requestedMonth = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date());
  const students = await env.DB.prepare(`SELECT s.id, s.name, c.id AS contract_id, c.course, c.lesson_type, c.group_id,
      mc.granted, mc.reserved, mc.completed, mc.forfeited, mc.expired,
      coalesce(mc.granted - mc.reserved - mc.completed - mc.forfeited - mc.expired, 0) AS remaining,
      (SELECT count(*) FROM makeup_credits mk WHERE mk.student_id = s.id AND mk.status = 'available' AND mk.expires_on >= date('now', '+9 hours')) AS makeup_available
    FROM students s LEFT JOIN contracts c ON c.student_id = s.id AND c.status = 'active'
    LEFT JOIN monthly_credits mc ON mc.contract_id = c.id AND mc.month = ?
    WHERE s.id IN (${placeholders}) ORDER BY s.name`).bind(month, ...studentIds).all();
  return Response.json({ month, students: students.results }, { headers: { "cache-control": "no-store" } });
}
