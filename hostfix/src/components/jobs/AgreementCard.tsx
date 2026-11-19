import Link from "next/link";
import { agreeAction } from "@/app/actions/tradie";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, SectionTitle } from "@/components/ui/Bits";
import { TRADIE_AGREEMENT_VERSION, type Tradie } from "@/lib/tradies/service";

/**
 * The tradie agreement, agreed in the app (DECISIONS.md, 2026-11-20). Shown
 * until the tradie has agreed to the version in force; no offers come until
 * they have.
 */
export function AgreementCard({ tradie }: { tradie: Pick<Tradie, "agreementVersion"> }) {
  if (tradie.agreementVersion === TRADIE_AGREEMENT_VERSION) return null;
  return (
    <Card className="border-alert/40 sm:p-6">
      <SectionTitle>{tradie.agreementVersion ? "The tradie agreement has changed" : "Read and agree to the tradie agreement"}</SectionTitle>
      <p className="text-muted">
        It is short and in plain English: the offers, the prices, the pay and what we expect from each other.{" "}
        {tradie.agreementVersion ? "No offers come to you until you agree to the new version." : "No offers come to you until you agree."}
      </p>
      <Link href="/legal/tradie-agreement" target="_blank" className="mt-2 inline-block font-semibold text-brand underline underline-offset-2">
        Read the tradie agreement ({TRADIE_AGREEMENT_VERSION})
      </Link>
      <ActionForm action={agreeAction} className="mt-4">
        <SubmitButton pendingLabel="Saving...">I have read it and I agree</SubmitButton>
      </ActionForm>
    </Card>
  );
}
