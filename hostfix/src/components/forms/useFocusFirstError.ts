"use client";

import { useEffect, useRef } from "react";
import type { LeadFormState } from "@/lib/leads/form-state";

/** After a failed submit, moves the cursor to the first field that needs fixing. */
export function useFocusFirstError(state: LeadFormState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = first?.tagName === "FIELDSET" ? first.querySelector<HTMLElement>("input") : first;
    target?.focus();
  }, [state]);
  return formRef;
}
