import type { Metadata } from "next";
import { saveAccount } from "@/app/actions/owner";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, PageTitle, RowLink, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { SignOut } from "@/components/ui/SignOut";
import { brand } from "@config/brand";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getOwner } from "@/lib/owners/service";
import { displayPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await requireOwner("/app/account");
  const owner = await getOwner(await getDb(), viewer.ownerId);
  const contact = brand.contact.email.includes("[EDIT") ? null : brand.contact.email;
  const leading = (name: "card" | "shield" | "log") => (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
      <Icon name={name} />
    </span>
  );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageTitle title="Account" />
      <Card className="sm:p-6">
        <SectionTitle>Your details</SectionTitle>
        <ActionForm action={saveAccount} className="space-y-4">
          <Field label="Name" name="name" required maxLength={80} autoComplete="name" defaultValue={owner?.name ?? viewer.user.name} />
          <Field
            label="Mobile"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            maxLength={30}
            autoComplete="tel"
            defaultValue={owner?.phone ? displayPhone(owner.phone) : ""}
            hint="We text this number when a tradie is booked, when a quote needs your answer and when a job is done."
          />
          <div>
            <p className="text-sm font-semibold text-ink">Email</p>
            <p className="mt-1 text-muted">{owner?.email ?? "None"}</p>
            <p className="mt-1 text-sm text-muted">You sign in with this. To change it, contact us.</p>
          </div>
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </ActionForm>
      </Card>

      <div className="space-y-2.5">
        <RowLink href="/app/billing" title="Billing" subtitle="Your card, monthly statements and credits" leading={leading("card")} />
        <RowLink href="/legal/terms" title="Terms" subtitle="What we promise and what we ask of you" leading={leading("log")} />
        <RowLink href="/legal/privacy" title="Privacy" subtitle="What we keep and who sees it" leading={leading("shield")} />
      </div>

      <Card>
        <SectionTitle>Need a hand?</SectionTitle>
        {contact ? (
          <p className="text-muted">
            Email{" "}
            <a href={`mailto:${contact}`} className="font-semibold text-brand underline underline-offset-2">
              {contact}
            </a>{" "}
            and a person will answer.
          </p>
        ) : (
          <p className="text-muted">Reply to any text we send you and a person will answer.</p>
        )}
        <div className="mt-4 md:hidden">
          <SignOut />
        </div>
      </Card>
    </div>
  );
}
