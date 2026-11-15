"use client";

import { useState, type ReactNode } from "react";
import { secondaryButtonClass, smallButtonClass } from "../forms/styles";
import { Icon } from "./Icon";

/** Copies a link or a line of text, and says so. */
export function CopyButton({ text, label = "Copy link", small }: { text: string; label?: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={small ? smallButtonClass : secondaryButtonClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      <Icon name={copied ? "check" : "log"} size={16} />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/**
 * Opens the phone's own share sheet (text, WhatsApp, email) with a message
 * ready to send. On a computer, where there is no share sheet, it copies the
 * message instead.
 */
export function ShareButton({ text, url, label, className }: { text: string; url: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className ?? secondaryButtonClass}
      onClick={async () => {
        if (typeof navigator.share === "function") {
          try {
            await navigator.share({ text, url });
          } catch {
            // The person closed the share sheet. Nothing to do.
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(`${text} ${url}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Copy this:", `${text} ${url}`);
        }
      }}
    >
      <Icon name={copied ? "check" : "phone"} size={16} />
      <span aria-live="polite">{copied ? "Copied. Paste it into a text." : label}</span>
    </button>
  );
}

export function PrintButton({ children = "Print" }: { children?: ReactNode }) {
  return (
    <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>
      {children}
    </button>
  );
}
