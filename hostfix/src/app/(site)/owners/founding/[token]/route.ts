import { NextResponse, type NextRequest } from "next/server";
import { createLeadToken, LEAD_COOKIE, LEAD_COOKIE_SECONDS, readLeadToken } from "@/lib/auth/lead-token";
import { appSecret, baseUrl } from "@/lib/env";

/**
 * The "take a founding spot" link in a price list email. It remembers who the
 * owner is on this device (the same signed cookie the form sets) and sends
 * them to the page with the deposit button. Opening it changes nothing else,
 * so a mail program previewing the link does no harm.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = appSecret();
  const leadId = secret ? readLeadToken(secret, token) : null;
  if (!secret || !leadId) return NextResponse.redirect(new URL("/owners", baseUrl()), 303);

  const response = NextResponse.redirect(new URL("/owners/thanks?from=email", baseUrl()), 303);
  response.cookies.set(LEAD_COOKIE, createLeadToken(secret, leadId), {
    httpOnly: true,
    secure: baseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: LEAD_COOKIE_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
