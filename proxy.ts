import { NextResponse, type NextRequest } from "next/server";
import { localDemoRequestAllowed } from "./lib/demo";

// This is a demonstration with selectable roles, never a public login system.
export function proxy(request: NextRequest) {
  if (!localDemoRequestAllowed(request)) return new Response("Local portfolio demo only", { status: 403 });
  return NextResponse.next();
}
export const config = { matcher: "/:path*" };
