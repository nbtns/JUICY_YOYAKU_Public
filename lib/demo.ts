export const DEMO_COOKIE = "juicy-demo-role";
export type DemoRole = "admin" | "member";

export function demoRole(cookie: string | null): DemoRole | null {
  const value = cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(DEMO_COOKIE + "="))?.slice(DEMO_COOKIE.length + 1);
  return value === "admin" || value === "member" ? value : null;
}

export function demoEmail(role: DemoRole) {
  return role === "admin" ? "teacher@example.com" : "member@example.com";
}

export function localDemoRequestAllowed(request: Request) {
  const url = new URL(request.url);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!localHosts.has(url.hostname)) return false;
  const host = request.headers.get("host");
  if (host && host !== url.host) return false;
  // Prevent other sites from operating a visitor's local demonstration database.
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === url.origin;
}
