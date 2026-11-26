"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ServiceArea } from "@config/markets";
import { FieldMessages } from "@/components/forms/Fields";
import { inputClass, labelClass } from "@/components/forms/styles";
import { areaForSuburb } from "@/lib/markets/areas";

/**
 * The property's service area (DECISIONS.md, 2026-11-26), picked from the
 * market's list. It follows the suburb typed in the same form ("suburb") until
 * the owner picks one themselves. "Not sure" leaves it to the suburb on saving.
 */
export function AreaPicker({ areas, defaultValue, suburbField = "suburb" }: { areas: readonly ServiceArea[]; defaultValue?: string | null; suburbField?: string }) {
  const id = useId();
  const ref = useRef<HTMLSelectElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  // True once the owner picks an area themselves: from then on the suburb no longer changes it.
  const picked = useRef(false);

  useEffect(() => {
    const input = ref.current?.form?.elements.namedItem(suburbField);
    if (!(input instanceof HTMLInputElement)) return;
    const follow = () => {
      if (!picked.current) setValue(areaForSuburb(areas, input.value) ?? "");
    };
    if (!defaultValue) follow();
    input.addEventListener("input", follow);
    return () => input.removeEventListener("input", follow);
  }, [areas, suburbField, defaultValue]);

  if (areas.length === 0) return null;
  const hint = "Tradies choose the areas they cover, and only those who cover this one are offered its jobs. There is no travel charge.";
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Area
      </label>
      <select
        ref={ref}
        id={id}
        name="area"
        value={value}
        onChange={(event) => {
          picked.current = event.target.value !== "";
          setValue(event.target.value);
        }}
        aria-describedby={`${id}-hint`}
        className={`${inputClass} border-line`}
      >
        <option value="">Not sure</option>
        {areas.map((area) => (
          <option key={area.key} value={area.key}>
            {area.name}
          </option>
        ))}
      </select>
      <FieldMessages name={id} hint={hint} />
    </div>
  );
}
