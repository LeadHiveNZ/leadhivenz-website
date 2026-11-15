import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { NextSteps, ThanksShell } from "@/components/ThanksShell";
import { TrackEvent } from "@/components/tracking/TrackEvent";
import { currentLead, isNewLead } from "@/lib/leads/current";

export const metadata: Metadata = {
  title: "You're on the list",
  robots: { index: false, follow: false },
};

export default function TradieThanksPage() {
  return (
    <ThanksShell title="You're on the list.">
      <p>
        Thanks. We&apos;ve got your details and we&apos;ll be in touch before {brand.name} starts sending jobs in {launchMarket.name}.
      </p>
      <Suspense fallback={null}>
        <LeadTracking />
      </Suspense>
      <NextSteps
        steps={[
          "We'll call you for a quick chat about the work you do and the area you cover.",
          "If your trade needs a licence, we'll ask for the number and expiry date.",
          "You set up your bank details once, then jobs start arriving by text.",
        ]}
      />
    </ThanksShell>
  );
}

/** Tells the Meta Pixel about the new tradie lead, once. */
async function LeadTracking() {
  // Wait for a real visit. This part must never be worked out ahead of time.
  await connection();
  const lead = await currentLead();
  if (!lead || lead.leadType !== "tradie" || !isNewLead(lead)) return null;
  return <TrackEvent name="SubmitApplication" eventId={lead.id} />;
}
