import { DEMO_COOKIE, localDemoRequestAllowed } from "@/lib/demo";

export async function GET(request: Request) {
  if (!localDemoRequestAllowed(request)) return new Response("Local demo only", { status: 403 });
  const role = new URL(request.url).searchParams.get("role");
  const active = role === "admin" || role === "member";
  const destination = role === "admin" ? "/admin" : role === "member" ? "/member" : "/";
  return new Response(null, { status: 303, headers: {
    location: destination,
    "set-cookie": DEMO_COOKIE + "=" + (active ? role : "") + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + (active ? "7200" : "0"),
    "cache-control": "no-store",
  } });
}
