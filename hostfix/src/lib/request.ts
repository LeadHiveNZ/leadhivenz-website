import "server-only";
import { appSecret } from "@/lib/env";
import { sha256Hex } from "@/lib/auth/signing";

type HeaderReader = { get(name: string): string | null };

/** The visitor's network address, as reported by the hosting platform. */
export function clientIp(headers: HeaderReader): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip = first || headers.get("x-real-ip")?.trim() || null;
  return ip && ip.length <= 64 ? ip : null;
}

/**
 * A scrambled form of the address, used only to count how often one visitor
 * submits a form. The real address is never stored.
 */
export function ipKey(headers: HeaderReader): string | null {
  const ip = clientIp(headers);
  if (!ip) return null;
  return sha256Hex(`${appSecret() ?? "hostfix"}|${ip}`).slice(0, 32);
}
