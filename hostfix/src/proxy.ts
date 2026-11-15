import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readAdminSettings, verifyAdminToken } from "@/lib/auth/admin-session";
import { SESSION_COOKIE } from "@/lib/auth/sessions";

/**
 * Runs before the private pages load. It only tidies up where people land:
 * someone with no sign-in cookie at all is sent to the right sign-in page
 * straight away, instead of seeing a page start to load and then bounce.
 *
 * This is a convenience, not the lock. Every private page, action and download
 * checks the sign-in again for itself (src/lib/auth/current.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/app") || pathname.startsWith("/tradie/") || pathname === "/tradie") {
    if (!hasSession) {
      const target = new URL("/sign-in", request.url);
      target.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(target);
    }
    return NextResponse.next();
  }

  const result = readAdminSettings(process.env);
  const adminPassword = "settings" in result && verifyAdminToken(result.settings, request.cookies.get(ADMIN_COOKIE)?.value);
  if (pathname === "/admin" && adminPassword && request.method === "GET") {
    return NextResponse.redirect(new URL("/admin/queue", request.url));
  }
  if (pathname.startsWith("/admin/") && !adminPassword && !hasSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/app", "/app/:path*", "/tradie", "/tradie/:path*"],
};
