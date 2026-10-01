import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { demoRole, demoEmail } from "@/lib/demo";

export async function requireDemoUser(returnTo: string) {
  const requestHeaders = await headers();
  const role = demoRole(requestHeaders.get("cookie"));
  if (!role) redirect(returnTo.startsWith("/admin") ? "/demo?role=admin" : "/demo?role=member");
  return { displayName: role === "admin" ? "デモ先生" : "デモ会員", email: demoEmail(role), fullName: null };
}

export function demoSignOutPath() { return "/demo?role=guest"; }
