import { runTimer } from "@/lib/after";
import { safeEqual } from "@/lib/auth/signing";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * THE TIMER. Vercel calls this address once a minute (see vercel.json). It
 * moves offers on to the next tradie, chases owners, flags missed promises,
 * retries cards, pays tradies and sends anything waiting.
 *
 * Only Vercel's own timer may call it: Vercel sends CRON_SECRET with each
 * call and anything without it is refused.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = env("CRON_SECRET");
  if (!secret || secret.length < 16) {
    return Response.json({ error: "CRON_SECRET is not set (or is shorter than 16 characters), so the timer cannot run." }, { status: 503 });
  }
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const report = await runTimer(await getDb());
    return Response.json({ ok: true, report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[tick] the timer failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "The timer could not run." }, { status: 500 });
  }
}
