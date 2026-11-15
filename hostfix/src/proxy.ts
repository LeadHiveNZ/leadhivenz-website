import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readAdminSettings, verifyAdminToken } from "@/lib/auth/admin-session";

/**
 * Runs before the admin pages load. It only tidies up where people land:
 *  - not signed in and asking for the leads list: send to the sign-in page
 *  - already signed in and on the sign-in page: send to the leads list
 *
 * This is a convenience, not the lock. Every admin page, action and download
 * checks the sign-in again for itself (see requireAdmin in src/lib/auth/admin.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const result = readAdminSettings(process.env);
  const signedIn = "settings" in result && verifyAdminToken(result.settings, request.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === "/admin" && signedIn && request.method === "GET") {
    return NextResponse.redirect(new URL("/admin/leads", request.url));
  }
  if (pathname.startsWith("/admin/leads") && !signedIn) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
