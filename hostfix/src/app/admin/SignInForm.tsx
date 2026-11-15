"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions/admin";
import { FormMessage } from "@/components/forms/Fields";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/components/forms/styles";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="space-y-4">
      {state.message && <FormMessage>{state.message}</FormMessage>}
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${inputClass} border-line`}
        />
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
