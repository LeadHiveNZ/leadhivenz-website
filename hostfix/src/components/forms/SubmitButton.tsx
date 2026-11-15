"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, secondaryButtonClass } from "./styles";

type Props = {
  children: ReactNode;
  /** Shown while the form is being sent. */
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
};

/** A submit button that greys out and says so while its form is being sent. */
export function SubmitButton({ children, pendingLabel = "Sending...", variant = "primary", className = "" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${variant === "primary" ? buttonClass : secondaryButtonClass} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
