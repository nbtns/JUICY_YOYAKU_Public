import { availabilityForDate, safePublicError } from "@/lib/reservation-engine";
import { jsonError } from "@/lib/validation";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  try {
    return Response.json(await availabilityForDate(date), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const safe = safePublicError(error);
    return jsonError(safe.message, safe.status);
  }
}
