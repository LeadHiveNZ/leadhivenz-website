import Link from "next/link";
import { notFound } from "next/navigation";
import { finishDemoPayoutSetup } from "@/app/actions/demo";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice } from "@/components/ui/Bits";
import { currentViewer } from "@/lib/auth/current";
import { demoModeAllowed } from "@/lib/env";

/** The pretend "enter your bank details" page. On the live site this is Stripe's own page. */
export default async function DemoPayoutSetupPage({ params }: { params: Promise<{ tradieId: string }> }) {
  const { tradieId } = await params;
  const viewer = await currentViewer();
  if (!demoModeAllowed() || !viewer?.tradieId || viewer.tradieId !== tradieId) notFound();

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Notice tone="warn" title="Pretend bank details page">
        On the live site the tradie enters their bank account and proves who they are on Stripe&apos;s own secure page. It takes them about five minutes. Nothing is asked for in the demo.
      </Notice>
      <Card className="sm:p-6">
        <h1 className="display text-3xl text-ink">Bank details</h1>
        <p className="mt-2 text-muted">Press the button to pretend they have been entered and checked.</p>
        <ActionForm action={finishDemoPayoutSetup} className="mt-5">
          <SubmitButton pendingLabel="Saving..." className="w-full">
            Done: my bank details are in
          </SubmitButton>
        </ActionForm>
        <p className="mt-3 text-center text-sm">
          <Link href="/tradie/profile" className="font-semibold text-muted underline underline-offset-2">
            Go back
          </Link>
        </p>
      </Card>
    </div>
  );
}
