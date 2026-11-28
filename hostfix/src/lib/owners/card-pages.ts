import type { CountryCode, Market } from "@config/markets";
import type { Db } from "@/lib/db/types";
import { cardRefusal } from "@/lib/markets/launch";
import type { PaymentsGateway } from "@/lib/payments/gateway";
import { getBilling } from "./service";

/**
 * THE TWO PAGES AT THE PAYMENT COMPANY AN OWNER CAN OPEN FROM BILLING:
 * "change my card" and "add my bank account". Both are checked here, so the
 * buttons and the server agree, and both are refused in pre-launch
 * (DECISIONS.md, 2026-11-27, second entry) before the payment company is
 * asked for anything: no card or bank account is taken until the market is live.
 */

export type PageResult = { ok: true; url: string } | { ok: false; message: string };

/** Where the owner changes the card on file. */
export async function openCardPage(
  db: Db, gateway: PaymentsGateway | null, input: { ownerId: string; country: CountryCode; returnUrl: string },
): Promise<PageResult> {
  const refused = await cardRefusal(db, input.ownerId, input.country);
  if (refused) return { ok: false, message: refused };
  const billing = await getBilling(db, input.ownerId, input.country);
  if (!gateway || !billing || billing.provider !== gateway.provider) return { ok: false, message: "There is no card on file yet. It is added when you start a membership." };
  try {
    return { ok: true, url: await gateway.billingPortalUrl({ customerId: billing.customerId, ownerId: input.ownerId, returnUrl: input.returnUrl }) };
  } catch (error) {
    console.error("[billing] opening the card page failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "The card page could not be opened just now. Please try again." };
  }
}

/**
 * Where the owner adds their NZ bank account for big work (DECISIONS.md,
 * 2026-11-23, second entry). `market` is the job's market, or the one the
 * Billing page named.
 */
export async function openBankPage(
  db: Db, gateway: PaymentsGateway | null, input: { ownerId: string; market: Market | null; successUrl: string; cancelUrl: string },
): Promise<PageResult> {
  const { market } = input;
  if (!market || market.country !== "NZ") return { ok: false, message: "Paying from a bank account is only for New Zealand properties for now." };
  const refused = await cardRefusal(db, input.ownerId, market.country);
  if (refused) return { ok: false, message: refused };
  const billing = await getBilling(db, input.ownerId, market.country);
  if (!gateway || !billing || billing.provider !== gateway.provider) return { ok: false, message: "Add a card first: it is added when you cover your first property." };
  try {
    const page = await gateway.startBankSetup({ customerId: billing.customerId, ownerId: input.ownerId, market, successUrl: input.successUrl, cancelUrl: input.cancelUrl });
    return { ok: true, url: page.url };
  } catch (error) {
    console.error("[billing] opening the bank account page failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "The bank account page could not be opened just now. Please try again." };
  }
}
