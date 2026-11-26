"use client";

import { HOUR_OPTIONS } from "@/lib/time";
import { Select } from "./ActionForm";
import { labelClass } from "./styles";

/**
 * A tradie's own hours (DECISIONS.md, 2026-11-26, second entry): "Send me jobs from __ to __". Two selects, on the
 * half hour. Offers (and their texts and notifications) only come inside these hours, on the days ticked.
 */
export function HoursFields({ legend, from, to, hint }: { legend: string; from: number; to: number; hint?: string }) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="grid grid-cols-2 gap-3">
        <Select label="From" name="hoursFrom" options={HOUR_OPTIONS.filter((option) => Number(option.key) < 24)} placeholder="Choose a time" defaultValue={String(from)} required />
        <Select label="To" name="hoursTo" options={HOUR_OPTIONS.filter((option) => Number(option.key) > 0)} placeholder="Choose a time" defaultValue={String(to)} required />
      </div>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </fieldset>
  );
}
