/** Shared looks for buttons and form fields, so every form feels the same. */

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-55";

/** The main button: plum. One per screen. */
export const buttonClass = `${base} min-h-12 bg-brand px-6 py-3 text-base text-white shadow-sm hover:bg-brand-dark`;

/** The highlight button, for dark sections: lime with plum words. */
export const accentButtonClass = `${base} min-h-12 bg-accent px-6 py-3 text-base text-brand-dark shadow-sm hover:bg-accent-dark`;

export const secondaryButtonClass = `${base} min-h-11 border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:border-brand/40 hover:bg-tint`;

export const dangerButtonClass = `${base} min-h-11 border border-alert/30 bg-surface px-5 py-2.5 text-sm text-alert hover:bg-alert-soft`;

export const smallButtonClass = `${base} min-h-9 border border-line bg-surface px-3.5 py-1.5 text-sm text-ink hover:border-brand/40 hover:bg-tint`;

/** text-base (16px) matters: anything smaller makes iPhones zoom in on tap. */
export const inputClass =
  "block w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export const cardClass = "rounded-2xl border border-line bg-surface";
