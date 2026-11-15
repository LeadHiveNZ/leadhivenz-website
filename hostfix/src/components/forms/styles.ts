/** Shared looks for buttons and form fields, so every form feels the same. */

export const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-ink shadow-sm transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60";

/** text-base (16px) matters: anything smaller makes iPhones zoom in on tap. */
export const inputClass =
  "block w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export const labelClass = "mb-1.5 block text-sm font-semibold text-ink";
