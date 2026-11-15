import type { ReactNode } from "react";
import { inputClass, labelClass } from "./styles";

/**
 * Form fields with a label, an optional hint and an error message, wired up
 * so screen readers announce the error with the field.
 */

type BaseProps = {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

function describedBy(name: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function borderClass(error?: string): string {
  return error ? "border-red-600" : "border-line";
}

export function FieldMessages({ name, hint, error }: { name: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${name}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </>
  );
}

type TextFieldProps = BaseProps & {
  type?: "text" | "tel" | "email" | "number" | "date";
  inputMode?: "text" | "tel" | "email" | "numeric" | "decimal";
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  min?: number;
  max?: number;
  maxLength?: number;
};

export function TextField({ label, name, hint, error, type = "text", ...rest }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={`${inputClass} ${borderClass(error)}`}
        {...rest}
      />
      <FieldMessages name={name} hint={hint} error={error} />
    </div>
  );
}

type SelectFieldProps = BaseProps & {
  options: readonly { key: string; label: string }[];
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
};

export function SelectField({ label, name, hint, error, options, placeholder, required, defaultValue }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select
        // Rebuild the list when the saved choice changes. Without this the
        // choice is lost when the form comes back with a message to fix.
        key={defaultValue ?? ""}
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={`${inputClass} ${borderClass(error)} appearance-none bg-[length:1.25rem] bg-[right_0.9rem_center] bg-no-repeat pr-11`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2355657a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 7.5 5 5 5-5'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages name={name} hint={hint} error={error} />
    </div>
  );
}

type CheckboxGroupProps = BaseProps & {
  options: readonly { key: string; label: string }[];
  defaultValues?: string[];
};

export function CheckboxGroup({ label, name, hint, error, options, defaultValues = [] }: CheckboxGroupProps) {
  return (
    <fieldset aria-describedby={describedBy(name, hint, error)} aria-invalid={error ? true : undefined}>
      <legend className={labelClass}>{label}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {options.map((option) => (
          <label
            key={option.key}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border bg-white px-2 text-base font-medium text-ink has-[:checked]:border-brand has-[:checked]:bg-tint has-[:checked]:text-brand-dark has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${borderClass(
              error,
            )}`}
          >
            <input
              type="checkbox"
              name={name}
              value={option.key}
              defaultChecked={defaultValues.includes(option.key)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldMessages name={name} hint={hint} error={error} />
    </fieldset>
  );
}

export function FormMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {children}
    </p>
  );
}
