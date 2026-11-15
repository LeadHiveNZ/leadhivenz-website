import Link from "next/link";
import { notFound } from "next/navigation";
import { chooseDemoCard } from "@/app/actions/demo";
import { ActionForm, RadioCards } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice } from "@/components/ui/Bits";
import { currentViewer } from "@/lib/auth/current";
import { demoModeAllowed } from "@/lib/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The pretend "change my card" page. On the live site this is Stripe's own page. */
export default async function DemoCardPage({ params, searchParams }: { params: Promise<{ ownerId: string }>; searchParams: SearchParams }) {
  const { ownerId } = await params;
  const query = await searchParams;
  const viewer = await currentViewer();
  if (!demoModeAllowed() || !viewer?.ownerId || viewer.ownerId !== ownerId) notFound();

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Notice tone="warn" title="Pretend card page">
        On the live site the owner changes their card on Stripe&apos;s own secure page. Here you choose which pretend card they have, to see what happens when a card works and when it does not.
      </Notice>
      {query.declined && (
        <Notice tone="error" title="That card was declined">
          Choose the card that works and try again.
        </Notice>
      )}
      <Card className="sm:p-6">
        <h1 className="display text-3xl text-ink">Which card?</h1>
        <ActionForm action={chooseDemoCard} className="mt-4 space-y-4">
          <RadioCards
            name="card"
            legend="Card on file"
            defaultValue="ok"
            options={[
              { value: "ok", title: "A card that works", detail: "Visa ending 4242. Memberships and jobs are charged without a hitch." },
              { value: "declines", title: "A card that is always declined", detail: "Visa ending 0002. Finished jobs fail to charge and land in the dispatcher's queue." },
            ]}
          />
          <SubmitButton pendingLabel="Saving..." className="w-full">
            Use this card
          </SubmitButton>
        </ActionForm>
        <p className="mt-3 text-center text-sm">
          <Link href="/app/billing" className="font-semibold text-muted underline underline-offset-2">
            Go back
          </Link>
        </p>
      </Card>
    </div>
  );
}
