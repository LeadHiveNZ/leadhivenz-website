import Link from "next/link";
import { notFound } from "next/navigation";
import { payDemoCheckout } from "@/app/actions/demo";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Facts, Notice } from "@/components/ui/Bits";
import { currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { demoModeAllowed } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getDemoCheckout } from "@/lib/payments/demo-gateway";

/** The pretend card page. On the live site this is Stripe's own page, and card details never touch this app. */
export default async function DemoCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentViewer();
  if (!demoModeAllowed()) notFound();
  const checkout = await getDemoCheckout(await getDb(), id);
  if (!checkout || !viewer?.ownerId || viewer.ownerId !== checkout.ownerId) notFound();
  const money = (cents: number) => formatMoney(cents, checkout.currency);
  const today = Math.max(0, checkout.priceCents - checkout.discountCents);
  const back = checkout.cancelUrl.replace(/^https?:\/\/[^/]+/, "") || "/app";

  if (checkout.bankOnly) {
    // The "add your bank account" page (DECISIONS.md, 2026-11-23, second entry): saves a pretend NZ bank account.
    return (
      <div className="mx-auto max-w-md space-y-5">
        <Notice tone="warn" title="Pretend bank page">
          On the live site the owner types their bank account into Stripe&apos;s own secure page here and agrees the direct debit. In the demo, nothing is saved or taken.
        </Notice>
        <Card className="sm:p-6">
          <h1 className="display text-3xl text-ink">Add a bank account</h1>
          <div className="mt-4">
            <Facts
              rows={[
                { label: "Taken today", value: <span className="text-xl">{money(0)}</span> },
                { label: "Taken later", value: "Half of approved work over NZ$1,000, then the rest at Job done" },
                { label: "Account", value: "ASB ending 0010 (pretend)" },
              ]}
            />
          </div>
          <ActionForm action={payDemoCheckout} className="mt-5 space-y-3">
            <input type="hidden" name="checkoutId" value={checkout.id} />
            <SubmitButton pendingLabel="Saving..." className="w-full">
              Save bank account
            </SubmitButton>
          </ActionForm>
          <p className="mt-3 text-center text-sm">
            <Link href={back} className="font-semibold text-muted underline underline-offset-2">
              Go back without saving
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  if (checkout.setupOnly) {
    // A free membership: the page only saves a card.
    return (
      <div className="mx-auto max-w-md space-y-5">
        <Notice tone="warn" title="Pretend card page">
          On the live site the owner types their card into Stripe&apos;s own secure page at this point. In the demo, nothing is saved or charged.
        </Notice>
        <Card className="sm:p-6">
          <h1 className="display text-3xl text-ink">Add a card</h1>
          <p className="mt-1 text-muted">{checkout.propertyName}</p>
          <div className="mt-4">
            <Facts
              rows={[
                { label: "Charged today", value: <span className="text-xl">{money(0)}</span> },
                { label: "Charged later", value: "The fixed price of each job, when it is done" },
                { label: "Card", value: "Visa ending 4242 (pretend)" },
              ]}
            />
          </div>
          <ActionForm action={payDemoCheckout} className="mt-5 space-y-3">
            <input type="hidden" name="checkoutId" value={checkout.id} />
            <SubmitButton pendingLabel="Saving..." className="w-full">
              Save card
            </SubmitButton>
          </ActionForm>
          <p className="mt-3 text-center text-sm">
            <Link href={back} className="font-semibold text-muted underline underline-offset-2">
              Go back without saving
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Notice tone="warn" title="Pretend card page">
        On the live site the owner types their card into Stripe&apos;s own secure page at this point. In the demo, nothing is charged.
      </Notice>
      <Card className="sm:p-6">
        <h1 className="display text-3xl text-ink">{checkout.tierName} membership</h1>
        <p className="mt-1 text-muted">{checkout.propertyName}</p>
        <div className="mt-4">
          <Facts
            rows={[
              { label: "Each month", value: money(checkout.priceCents) },
              ...(checkout.discountCents > 0 ? [{ label: checkout.discountLabel ?? "Credit", value: `-${money(checkout.discountCents)}` }] : []),
              { label: "Charged today", value: <span className="text-xl">{money(today)}</span> },
              { label: "Card", value: "Visa ending 4242 (pretend)" },
            ]}
          />
        </div>
        <ActionForm action={payDemoCheckout} className="mt-5 space-y-3">
          <input type="hidden" name="checkoutId" value={checkout.id} />
          <SubmitButton pendingLabel="Paying..." className="w-full">
            Pay {money(today)} and start
          </SubmitButton>
        </ActionForm>
        <p className="mt-3 text-center text-sm">
          <Link href={back} className="font-semibold text-muted underline underline-offset-2">
            Go back without paying
          </Link>
        </p>
      </Card>
    </div>
  );
}
