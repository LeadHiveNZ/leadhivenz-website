"use server";

import { redirect } from "next/navigation";
import { findMarket, launchMarket } from "@config/markets";
import { baseUrl } from "@/lib/env";
import { currentLead } from "@/lib/leads/current";
import { DepositNotAllowedError, startDepositCheckout } from "@/lib/payments/deposit";
import { getStore } from "@/lib/store";

/**
 * Runs when an owner presses "Reserve my founding spot". Sends them to the
 * card page hosted by Stripe. Who they are comes from their signed cookie,
 * never from anything the browser sends in the form.
 */
export async function startDeposit(): Promise<void> {
  const lead = await currentLead();
  if (!lead || lead.leadType !== "owner") redirect("/owners");
  if (lead.depositStatus === "paid") redirect("/owners/founding-member");

  const market = findMarket(lead.market) ?? launchMarket;
  let checkoutUrl: string;
  try {
    const result = await startDepositCheckout(lead, market, baseUrl(), { store: getStore() });
    checkoutUrl = result.url;
  } catch (error) {
    if (!(error instanceof DepositNotAllowedError)) {
      console.error("[deposit] could not start the card payment:", error instanceof Error ? error.message : error);
    }
    redirect("/owners/thanks?deposit=unavailable");
  }
  redirect(checkoutUrl);
}
