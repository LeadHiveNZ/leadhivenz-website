"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitOwnerLead } from "@/app/actions/leads";
import type { LeadFormState } from "@/lib/leads/form-state";
import { MANAGED_BY_OPTIONS } from "@/lib/leads/options";
import { FormMessage, SelectField, TextField } from "./Fields";
import { LeadFormHiddenFields } from "./HiddenFields";
import { SubmitButton } from "./SubmitButton";
import { useFocusFirstError } from "./useFocusFirstError";

const initialState: LeadFormState = {};

type Props = {
  marketName: string;
  brandName: string;
};

/**
 * The owner form on the landing page. One button: "Send me the price list".
 * HostFix is free to join (DECISIONS.md, 2026-11-17), so the founding deposit
 * button is gone; the choice is still recorded as the lead's intent.
 */
export function OwnerLeadForm({ marketName, brandName }: Props) {
  const [state, formAction] = useActionState(submitOwnerLead, initialState);
  const formRef = useFocusFirstError(state);
  const value = (name: string) => {
    const saved = state.values?.[name];
    return typeof saved === "string" ? saved : undefined;
  };
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
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={value("email")}
        error={errors.email}
      />
      <TextField
        label={`How many properties do you have in ${marketName}?`}
        name="propertyCount"
        type="number"
        inputMode="numeric"
        min={1}
        max={200}
        required
        defaultValue={value("propertyCount") ?? "1"}
        error={errors.propertyCount}
      />
      <SelectField
        label="Who looks after them now?"
        name="managedBy"
        options={MANAGED_BY_OPTIONS}
        placeholder="Choose one"
        required
        defaultValue={value("managedBy")}
        error={errors.managedBy}
      />
      <TextField
        label="Where do you live?"
        name="ownerLocation"
        autoComplete="address-level2"
        placeholder="Town or city"
        required
        maxLength={80}
        defaultValue={value("ownerLocation")}
        error={errors.ownerLocation}
      />

      <SubmitButton name="intent" value="pricelist" className="w-full">
        Send me the price list
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        We only use your details to contact you about {brandName}.{" "}
        <Link href="/legal/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </form>
  );
}
