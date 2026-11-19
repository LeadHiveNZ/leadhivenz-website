import { text } from "@/lib/forms";
import { normalisePhone } from "@/lib/phone";
import type { GuestStaying } from "./create";

/**
 * The guest questions on the report form (DECISIONS.md, 2026-11-20, second
 * entry): is a guest staying, their first name and mobile, and whether the
 * tradie may let themselves in if nobody answers. Returns the answers, or a
 * plain-words problem with the mobile number.
 */
export function guestFromForm(formData: FormData, country: "NZ" | "AU"): { ok: true; guest: { guestStaying: GuestStaying | null; guestName: string | null; guestPhone: string | null; mayLetIn: boolean | null } } | { ok: false; message: string } {
  const answer = text(formData, "guestStaying");
  const guestStaying = answer === "yes" || answer === "no" || answer === "not_sure" ? answer : null;
  const typed = guestStaying === "yes" || guestStaying === "not_sure" ? text(formData, "guestPhone") : "";
  const phone = typed ? normalisePhone(typed, country) : null;
  if (typed && !phone) return { ok: false, message: "The guest's mobile does not look like a mobile number. From overseas, start with + and the country code. Or leave it empty." };
  const letIn = text(formData, "mayLetIn");
  return {
    ok: true,
    guest: {
      guestStaying,
      guestName: guestStaying === "yes" || guestStaying === "not_sure" ? text(formData, "guestName") || null : null,
      guestPhone: phone?.e164 ?? null,
      mayLetIn: letIn === "yes" ? true : letIn === "no" ? false : null,
    },
  };
}
