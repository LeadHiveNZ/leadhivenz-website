"use client";

import Link from "next/link";
import { Suspense, use, useActionState } from "react";
import { submitTradieLead } from "@/app/actions/leads";
import type { LeadFormState } from "@/lib/leads/form-state";
import { DAY_OPTIONS } from "@/lib/leads/options";
import { CERTIFICATE_ACCEPT, CheckboxGroup, FileField, FormMessage, SelectField, TextField } from "./Fields";
import { LeadFormHiddenFields } from "./HiddenFields";
import { SubmitButton } from "./SubmitButton";
import { useFocusFirstError } from "./useFocusFirstError";

const initialState: LeadFormState = {};

type Props = {
  brandName: string;
  buttonLabel: string;
  trades: { key: string; label: string }[];
  /**
   * False when file storage is not set up: the certificate field shows, with a note to add it later from the
   * profile. The landing page passes a promise worked out on each visit, so only this field waits for it.
   */
  certificateUploads?: boolean | Promise<boolean>;
};

const CERTIFICATE = {
  label: "Public liability insurance certificate",
  name: "certificate",
  accept: CERTIFICATE_ACCEPT,
  hint: "The certificate of currency from your insurer: a PDF, JPG or PNG, up to 4 MB. We need it before we can offer you any work. Not to hand? Add it later from your profile.",
  laterNote: "Uploads aren't switched on here yet. You can add your certificate later from your profile. We need it before we can offer you any work.",
};

function CertificateField({ ready, error }: { ready: boolean | Promise<boolean>; error?: string }) {
  const uploads = typeof ready === "boolean" ? ready : use(ready);
  return <FileField {...CERTIFICATE} ready={uploads} error={error} />;
}

export function TradieLeadForm({ brandName, buttonLabel, trades, certificateUploads = true }: Props) {
  const [state, formAction] = useActionState(submitTradieLead, initialState);
  const formRef = useFocusFirstError(state);
  const value = (name: string) => {
    const saved = state.values?.[name];
    return typeof saved === "string" ? saved : undefined;
  };
  const savedDays = state.values?.daysAvailable;
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="relative space-y-4">
      <LeadFormHiddenFields />
      {state.message && <FormMessage>{state.message}</FormMessage>}

      <TextField label="Your name" name="name" autoComplete="name" required maxLength={80} defaultValue={value("name")} error={errors.name} />
      <TextField
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        maxLength={30}
        defaultValue={value("phone")}
        error={errors.phone}
      />
      <SelectField
        label="Your trade"
        name="trade"
        options={trades}
        placeholder="Choose your trade"
        required
        defaultValue={value("trade")}
        error={errors.trade}
      />
      <TextField
        label="Licence number"
        name="licenceNumber"
        hint="Only if your trade needs one. Leave it blank if not."
        autoComplete="off"
        maxLength={60}
        defaultValue={value("licenceNumber")}
        error={errors.licenceNumber}
      />
      <TextField
        label="LBP number (Licensed Building Practitioner)"
        name="lbpNumber"
        hint="Optional. Some building work needs it. Most jobs do not."
        autoComplete="off"
        maxLength={40}
        defaultValue={value("lbpNumber")}
        error={errors.lbpNumber}
      />
      {/* Shown greyed out for the moment it takes to check, so nothing chosen is lost when it switches on. */}
      <Suspense fallback={<FileField {...CERTIFICATE} ready={false} laterNote={CERTIFICATE.hint} />}>
        <CertificateField ready={certificateUploads} error={errors.certificate} />
      </Suspense>
      <CheckboxGroup
        // Remount when the saved days change so the ticks are restored after a failed submit.
        key={Array.isArray(savedDays) ? savedDays.join(",") : "none"}
        label="Days you can usually work"
        name="daysAvailable"
        options={DAY_OPTIONS}
        defaultValues={Array.isArray(savedDays) ? savedDays : []}
        error={errors.daysAvailable}
      />

      <SubmitButton className="w-full">{buttonLabel}</SubmitButton>
      <p className="text-center text-xs text-muted">
        We only use your details to contact you about {brandName}.{" "}
        <Link href="/legal/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </form>
  );
}
