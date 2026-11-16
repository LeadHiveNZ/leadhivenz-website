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
  /**
   * The founding deposit, when it can be taken right now: the amount as shown,
   * for example "NZ$99". Null shows a single "send me the price list" button.
   */
  deposit: string | null;
};

/**
 * The owner form on the landing page. It has two buttons on purpose: taking a
 * founding spot (the deposit) or just getting the price list. Which one people
 * press is the main thing the demand test measures.
 */
export function OwnerLeadForm({ marketName, brandName, deposit }: Props) {
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

      {deposit ? (
        <div className="space-y-2.5 pt-1">
          <SubmitButton name="intent" value="deposit" className="w-full" pendingLabel="Opening the card page...">
            Take a founding spot · {deposit} deposit
          </SubmitButton>
          <SubmitButton name="intent" value="pricelist" variant="secondary" className="w-full" pendingLabel="Sending...">
            Not yet: just send me the price list
          </SubmitButton>
          <p className="text-center text-xs text-muted">The deposit is taken by card on a secure page run by Stripe. We never see your card number.</p>
        </div>
      ) : (
        <SubmitButton name="intent" value="pricelist" className="w-full">
          Send me the price list
        </SubmitButton>
      )}
      <p className="text-center text-xs text-muted">
        We only use your details to contact you about {brandName}.{" "}
        <Link href="/legal/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </form>
  );
}
