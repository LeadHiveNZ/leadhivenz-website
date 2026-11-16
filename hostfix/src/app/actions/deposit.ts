"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { currentLead } from "@/lib/leads/current";
import { currentMarket, foundingSpotsTaken, spotsLeft } from "@/lib/leads/founding";
import { DepositNotAllowedError, startDepositCheckout } from "@/lib/payments/deposit";
import { getStore } from "@/lib/store";

/**
 * Runs when an owner presses "Take a founding spot" on the thank-you page (or
 * after following the link in their price list email). Sends them to the
 * card page hosted by Stripe. Who they are comes from their signed cookie,
 * never from anything the browser sends in the form.
 *
 * The amount, the promises and the number of spots are the ones set on the
 * admin screen, so what the page says is what the card is charged.
 */
export async function startDeposit(): Promise<void> {
  const lead = await currentLead();
  if (!lead || lead.leadType !== "owner") redirect("/owners");
  if (lead.depositStatus === "paid" || lead.depositStatus === "credited") redirect("/owners/founding-member");

  let checkoutUrl: string;
  try {
    const market = await currentMarket(getDb, lead.market);
    const left = spotsLeft(market, await foundingSpotsTaken(await getDb(), market.slug));
    if (left === 0) checkoutUrl = "/owners/thanks?deposit=full";
    else {
      await getStore().recordIntent(lead.id, "deposit");
      checkoutUrl = (await startDepositCheckout(lead, market, baseUrl(), { store: getStore(), spotsLeft: left })).url;
    }
  } catch (error) {
    if (!(error instanceof DepositNotAllowedError)) {
      console.error("[deposit] could not start the card payment:", error instanceof Error ? error.message : error);
    }
    redirect("/owners/thanks?deposit=unavailable");
  }
  redirect(checkoutUrl);
}
