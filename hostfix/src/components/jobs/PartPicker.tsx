"use client";

import { inputClass, labelClass } from "@/components/forms/styles";

/**
 * A quick pick from the market's price list (DECISIONS.md, 2026-11-23). Picking
 * one fills in the part's name and price in the row below it. Both stay
 * editable: the price is the tradie's own. Without JavaScript the list is
 * still sent, and the tradie types the name and price.
 */
export function PartPicker({ row, items }: { row: number; items: { id: string; name: string; price: string; label: string }[] }) {
  if (items.length === 0) return null;
  const id = `part-${row}-item`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Pick from the price list (optional)
      </label>
      <select
        id={id}
        name={id}
        defaultValue=""
        className={`${inputClass} mt-1.5 border-line`}
        onChange={(event) => {
          const item = items.find((entry) => entry.id === event.target.value);
          if (!item) return;
          const name = document.getElementById(`part-${row}-name`) as HTMLInputElement | null;
          const price = document.getElementById(`part-${row}-price`) as HTMLInputElement | null;
          if (name) name.value = item.name;
          if (price) price.value = item.price;
        }}
      >
        <option value="">Type it in below</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
