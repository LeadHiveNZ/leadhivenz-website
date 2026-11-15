"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/forms";
import { CheckboxGroup, FormMessage, SelectField, TextField } from "./Fields";
import { inputClass, labelClass } from "./styles";

/**
 * A form that sends itself to a server action and shows what comes back: a
 * message at the top, a note under each field that needs fixing, and whatever
 * the person typed put back so nothing has to be typed twice.
 *
 * It works without JavaScript too (the browser simply posts the form).
 */

const FormContext = createContext<FormState>({});

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

export function ActionForm({ action, children, className = "space-y-4" }: { action: Action; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    const first = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = first?.tagName === "FIELDSET" ? first.querySelector<HTMLElement>("input") : first;
    target?.focus();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      <FormContext.Provider value={state}>
        {state.message && <FormMessage>{state.message}</FormMessage>}
        {state.done && (
          <p role="status" className="rounded-xl border border-done/30 bg-done-soft px-4 py-3 text-sm font-semibold text-done">
            {state.done}
          </p>
        )}
        {children}
      </FormContext.Provider>
    </form>
  );
}

function saved(state: FormState, name: string): string | undefined {
  const value = state.values?.[name];
  return typeof value === "string" ? value : undefined;
}

type TextProps = Omit<Parameters<typeof TextField>[0], "error">;

/** A text box that remembers what was typed and shows its own error. */
export function Field(props: TextProps) {
  const state = useContext(FormContext);
  return <TextField {...props} defaultValue={saved(state, props.name) ?? props.defaultValue} error={state.fieldErrors?.[props.name]} />;
}

type SelectProps = Omit<Parameters<typeof SelectField>[0], "error">;

export function Select(props: SelectProps) {
  const state = useContext(FormContext);
  return <SelectField {...props} defaultValue={saved(state, props.name) ?? props.defaultValue} error={state.fieldErrors?.[props.name]} />;
}

type ChecksProps = Omit<Parameters<typeof CheckboxGroup>[0], "error">;

export function Checks(props: ChecksProps) {
  const state = useContext(FormContext);
  const value = state.values?.[props.name];
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : props.defaultValues;
  return <CheckboxGroup {...props} defaultValues={values} error={state.fieldErrors?.[props.name]} />;
}

type AreaProps = { label: string; name: string; hint?: string; rows?: number; placeholder?: string; required?: boolean; defaultValue?: string; maxLength?: number };

/** A bigger text box for notes and descriptions. */
export function Area({ label, name, hint, rows = 4, placeholder, required, defaultValue, maxLength = 2000 }: AreaProps) {
  const state = useContext(FormContext);
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={saved(state, name) ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined}
        className={`${inputClass} ${error ? "border-red-600" : "border-line"}`}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** A single tick box with its own line of text. */
export function Tick({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  const state = useContext(FormContext);
  const value = state.values ? state.values[name] !== undefined : defaultChecked;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-4 py-3">
      <input type="checkbox" name={name} defaultChecked={value} key={String(value)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--hf-brand)]" />
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export type RadioOption = { value: string; title: string; detail?: string; right?: string; badge?: string };

/** A choice between a few options, each shown as a tappable card. Keeps the choice after a problem. */
export function RadioCards({ name, legend, options, defaultValue, hint }: { name: string; legend: string; options: RadioOption[]; defaultValue?: string; hint?: string }) {
  const state = useContext(FormContext);
  const chosen = saved(state, name) ?? defaultValue ?? "";
  const error = state.fieldErrors?.[name];
  return (
    <fieldset aria-invalid={error ? true : undefined} key={chosen}>
      <legend className={labelClass}>{legend}</legend>
      {hint && <p className="-mt-1 mb-2 text-sm text-muted">{hint}</p>}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 transition has-[:checked]:border-brand has-[:checked]:bg-tint has-[:checked]:ring-2 has-[:checked]:ring-brand/20"
          >
            <input type="radio" name={name} value={option.value} defaultChecked={chosen === option.value} required className="mt-1 h-5 w-5 shrink-0 accent-[var(--hf-brand)]" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">{option.title}</span>
                {option.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-brand-dark uppercase">{option.badge}</span>}
              </span>
              {option.detail && <span className="mt-0.5 block text-sm text-muted">{option.detail}</span>}
            </span>
            {option.right && <span className="tabular shrink-0 text-right font-bold text-ink">{option.right}</span>}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </fieldset>
  );
}
