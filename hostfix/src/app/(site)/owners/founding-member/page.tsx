import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { findMarket, launchMarket } from "@config/markets";
import { NextSteps, ThanksShell } from "@/components/ThanksShell";
import { TrackEvent } from "@/components/tracking/TrackEvent";
import { baseUrl } from "@/lib/env";
import { currentLead, wasPaidRecently } from "@/lib/leads/current";
import { sendMetaEvent } from "@/lib/meta/capi";
import { formatMoney } from "@/lib/money";
import { clientIp } from "@/lib/request";

export const metadata: Metadata = {
  title: "Founding member",
  robots: { index: false, follow: false },
};

export default function FoundingMemberPage() {
  return (
    <Suspense fallback={<ThanksShell title="Checking your payment...">{null}</ThanksShell>}>
      <Confirmation />
    </Suspense>
  );
}

async function Confirmation() {
  // Wait for a real visit. This part must never be worked out ahead of time.
  await connection();
  const [lead, headerList, cookieStore] = await Promise.all([currentLead(), headers(), cookies()]);
  const contact = brand.contact.email.includes("[EDIT") ? null : brand.contact.email;

  if (lead?.depositStatus === "paid" && lead.depositAmount && lead.depositCurrency) {
    const market = findMarket(lead.market) ?? launchMarket;
    const money = formatMoney(lead.depositAmount, lead.depositCurrency);
    const eventId = `deposit-${lead.id}`;
    const paidRecently = wasPaidRecently(lead);

    if (paidRecently) {
      // Tell Meta from the server too. The matching id means it is counted once.
      const event = {
        name: "Purchase" as const,
        eventId,
        sourceUrl: `${baseUrl()}/owners/founding-member`,
        userAgent: headerList.get("user-agent"),
        ip: clientIp(headerList),
        email: lead.email,
        phone: lead.phone,
        fbp: cookieStore.get("_fbp")?.value ?? null,
        fbc: cookieStore.get("_fbc")?.value ?? null,
        fbclid: lead.fbclid,
        valueCents: lead.depositAmount,
        currency: lead.depositCurrency,
      };
      after(async () => {
        const outcome = await sendMetaEvent(event);
        if (outcome.status === "failed") console.error("[meta]", outcome.detail);
      });
    }

    return (
      <ThanksShell title="You're a founding member.">
        {paidRecently && (
          <TrackEvent name="Purchase" eventId={eventId} params={{ value: lead.depositAmount / 100, currency: lead.depositCurrency }} />
        )}
        <p>
          Your {money} deposit is confirmed and your spot in {market.name} is held. A receipt is on its way to your email.
        </p>
        {market.foundingDeposit.terms.length > 0 && (
          <ul className="list-disc space-y-1 pl-6 text-base">
            {market.foundingDeposit.terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        )}
        <NextSteps
          steps={[
            "We'll call or email you to hear about your property.",
            "You get first access when we open, before anyone else.",
            "Your deposit comes off your first month's membership.",
          ]}
        />
        {contact && (
          <p className="text-base">
            Changed your mind? Email{" "}
            <a href={`mailto:${contact}`} className="font-medium text-brand underline">
              {contact}
            </a>{" "}
            and we&apos;ll refund you.
          </p>
        )}
      </ThanksShell>
    );
  }

  if (lead?.depositStatus === "refunded") {
    return (
      <ThanksShell title="Your deposit has been refunded." tone="notice">
        <p>The money is on its way back to your card. It can take a few working days to show up.</p>
      </ThanksShell>
    );
  }

  return (
    <ThanksShell title="We haven't seen a payment yet." tone="notice">
      <p>
        If you just paid, give it a minute and refresh this page. Card payments can take a moment to reach us. If you closed the card page
        without paying, nothing was charged.
      </p>
      <p className="text-base">
        <Link href="/owners/thanks" className="font-medium text-brand underline">
          Back to the founding member offer
        </Link>
        {contact && (
          <>
            {" "}
            or email{" "}
            <a href={`mailto:${contact}`} className="font-medium text-brand underline">
              {contact}
            </a>
          </>
        )}
        .
      </p>
    </ThanksShell>
  );
}
