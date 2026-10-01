import { safePublicError } from "@/lib/reservation-engine";
import { verifiedTrial } from "@/lib/trial-access";
import { jsonError } from "@/lib/validation";

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await context.params;
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const trial = await verifiedTrial(reference, token);
    return Response.json({ reference: trial.reference, studentName: trial.student_name, startsAt: new Date(trial.starts_at).toISOString(), endsAt: new Date(trial.ends_at).toISOString(), status: trial.status }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
