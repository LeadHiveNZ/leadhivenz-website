"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { accentButtonClass, buttonClass, dangerButtonClass, secondaryButtonClass, smallButtonClass } from "./styles";

type Props = {
  children: ReactNode;
  /** Shown while the form is being sent. */
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "accent" | "danger" | "small";
  /** Sent with the form, for forms with more than one button. */
  name?: string;
  value?: string;
  className?: string;
};

/** A submit button that greys out and says so while its form is being sent. */
const LOOKS = { primary: buttonClass, secondary: secondaryButtonClass, accent: accentButtonClass, danger: dangerButtonClass, small: smallButtonClass };

export function SubmitButton({ children, pendingLabel = "Sending...", variant = "primary", className = "", name, value }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      name={name}
      value={value}
      className={`${LOOKS[variant]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
