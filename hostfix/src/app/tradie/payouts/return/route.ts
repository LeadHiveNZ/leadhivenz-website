import { NextResponse, type NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/markets/store";
import { paymentsFor } from "@/lib/payments";
import { getTradie, savePayoutAccount } from "@/lib/tradies/service";

/** Where the bank details page sends a tradie back to. Checks whether they can now be paid. */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const viewer = await currentViewer();
  if (!viewer?.tradieId) return to("/sign-in?next=/tradie/profile");
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const market = tradie ? await getMarket(db, tradie.market) : null;
  const gateway = market ? paymentsFor(db, market.country) : null;
  if (!tradie || !gateway || !tradie.payoutAccountId || tradie.payoutProvider !== gateway.provider) return to("/tradie/profile");
  try {
    const status = await gateway.payoutAccountStatus(tradie.payoutAccountId);
    await savePayoutAccount(db, tradie.id, { provider: gateway.provider, accountId: tradie.payoutAccountId, payoutsEnabled: status.payoutsEnabled });
    return to(`/tradie/profile?payouts=${status.payoutsEnabled ? "done" : status.detailsSubmitted ? "checking" : "again"}`);
  } catch (error) {
    console.error("[payouts] checking a payout account failed:", error instanceof Error ? error.message : error);
    return to("/tradie/profile?payouts=checking");
  }
}
