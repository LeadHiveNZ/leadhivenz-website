import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { acceptAsOwner, acceptAsTradie } from "@/app/actions/clients";
import { ActionForm, RadioCards } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice } from "@/components/ui/Bits";
import { Loading } from "@/components/ui/Loading";
import { PlainShell } from "@/components/ui/PlainShell";
import { brand } from "@config/brand";
import { currentViewer } from "@/lib/auth/current";
import { inviteFromLink } from "@/lib/clients/own-clients";
import { getDb } from "@/lib/db";
import { OWN_CLIENT_FEE_BPS } from "@/lib/jobs/pricing";
import { waitingMarkets } from "@/lib/markets/launch";
import { marketNames, preLaunchWords } from "@/lib/markets/stage";
import { listMarkets } from "@/lib/markets/store";
import { getPropertyForStaff, listProperties } from "@/lib/properties/service";
import { getTradie } from "@/lib/tradies/service";

export const metadata: Metadata = { title: "Your invite", robots: { index: false, follow: false } };

type Params = Promise<{ token: string }>;

/**
 * AN OWN-CLIENT INVITE (DECISIONS.md, 2026-11-23). A tradie's invite to their
 * client, or an owner's to their own tradie. Opening this page changes
 * nothing: phones and chat apps open links to preview them. The pair is made
 * only by pressing the button, signed in as the right person.
 */
export default function InvitePage({ params }: { params: Params }) {
  return (
    <PlainShell>
      <Suspense fallback={<Loading />}>
        <Invite params={params} />
      </Suspense>
    </PlainShell>
  );
}

async function Invite({ params }: { params: Params }) {
  const { token } = await params;
  await connection();
  const db = await getDb();
  const invite = await inviteFromLink(db, token);
  const viewer = await currentViewer();
  const next = encodeURIComponent(`/i/${token}`);
  if (!invite || invite.status === "cancelled") {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">That invite did not open</h1>
        <p className="text-lg text-muted">It may have been cut short when it was copied. Ask the person who sent it for a new one.</p>
      </div>
    );
  }
  const fee = `${OWN_CLIENT_FEE_BPS / 100}%`;

  if (invite.fromSide === "tradie") {
    const tradie = invite.tradieId ? await getTradie(db, invite.tradieId) : null;
    const name = tradie?.businessName ?? "Your tradie";
    const properties = viewer?.ownerId ? (await listProperties(db, viewer.ownerId)).filter((property) => property.status !== "cancelled") : [];
    // Pre-launch (DECISIONS.md, 2026-11-27, second entry): pairing up is only set-up, so it works now. Say when jobs can be booked.
    const waiting = properties.length > 0 ? waitingMarkets(properties, await listMarkets(db)) : [];
    return (
      <div className="space-y-5">
        <h1 className="display text-4xl text-ink">{name} uses {brand.name}</h1>
        <p className="text-lg text-muted">
          Book {name} through {brand.name}: fixed prices from the menu, texts when they are booked and when it is done, and your card charged only once it&rsquo;s fixed. Their
          jobs at your property carry our {fee} fee instead of the usual one, so their prices stay the same.
        </p>
        {!viewer?.ownerId ? (
          <Card className="space-y-3 sm:p-6">
            <p className="text-muted">Join free, add your property, then open this link again and press the button.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className="font-semibold text-brand underline underline-offset-2">Join {brand.name}</Link>
              <Link href={`/sign-in?next=${next}`} className="font-semibold text-brand underline underline-offset-2">I already have an account</Link>
            </div>
          </Card>
        ) : properties.length === 0 ? (
          <Card className="space-y-3 sm:p-6">
            <p className="text-muted">Add your property first, then open this link again.</p>
            <Link href="/app/properties/new" className="font-semibold text-brand underline underline-offset-2">Add a property</Link>
          </Card>
        ) : (
          <Card className="sm:p-6">
            <ActionForm action={acceptAsOwner} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <RadioCards name="propertyId" legend="Which property?" defaultValue={properties[0]!.id} options={properties.map((property) => ({ value: property.id, title: property.name, detail: [property.addressLine1, property.suburb].filter(Boolean).join(", ") }))} />
              <SubmitButton pendingLabel="Saving..." className="w-full">
                Book {name} through {brand.name} here
              </SubmitButton>
              <p className="text-sm text-muted">Nothing is booked or charged by pressing this. {name} becomes the first tradie we offer your jobs to there, in their trade.</p>
              {waiting.length > 0 && (
                <Notice tone="info" title={preLaunchWords.title(marketNames(waiting))}>
                  You can pair up now. Jobs can be booked from the day we go live.
                </Notice>
              )}
            </ActionForm>
          </Card>
        )}
      </div>
    );
  }

  const property = invite.propertyId ? await getPropertyForStaff(db, invite.propertyId) : null;
  return (
    <div className="space-y-5">
      <h1 className="display text-4xl text-ink">An owner wants to book you through {brand.name}</h1>
      <p className="text-lg text-muted">
        {property ? `For ${property.name}${property.suburb ? `, ${property.suburb}` : ""}. ` : ""}Once you are on {brand.name}, you are the first tradie offered their jobs there in your trade,
        at fixed menu prices, paid automatically. Jobs for this owner&rsquo;s property carry a {fee} platform fee, not the usual one.
      </p>
      {invite.status === "used" ? (
        <Notice tone="good" title="This invite has been used">The owner and their tradie are already set up.</Notice>
      ) : !viewer?.tradieId ? (
        <Card className="space-y-3 sm:p-6">
          <p className="text-muted">
            New to {brand.name}? Put your name down: we check your insurance and licence, and you agree to the tradie agreement, as every tradie does. Then open this link again
            and press the button.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/tradies" className="font-semibold text-brand underline underline-offset-2">Join as a tradie</Link>
            <Link href={`/sign-in?next=${next}`} className="font-semibold text-brand underline underline-offset-2">I already have an account</Link>
          </div>
        </Card>
      ) : (
        <Card className="sm:p-6">
          <ActionForm action={acceptAsTradie} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <SubmitButton pendingLabel="Saving..." className="w-full">
              Yes, I work for this owner
            </SubmitButton>
            <p className="text-sm text-muted">You are offered their jobs once you are approved. The tradie agreement, section 10, explains the {fee}.</p>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
