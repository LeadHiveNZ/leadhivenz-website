/** What a lead form shows after a submit that did not go through. */
export type LeadFormState = {
  /** A message for the top of the form. */
  message?: string;
  /** One message per field that needs fixing, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** What the person typed, so they do not have to type it again. */
  values?: Record<string, string | string[]>;
};

/** The hidden field real people never see. Named so browsers will not autofill it. */
export const HONEYPOT_FIELD = "hf_confirm_field";
