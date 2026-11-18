"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";
import { IMPORT_MAX_ROWS, parsePropertyRows } from "@/lib/properties/import";
import { ActionForm } from "../forms/ActionForm";
import { SubmitButton } from "../forms/SubmitButton";
import { inputClass, labelClass } from "../forms/styles";

type Props = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
};

/**
 * One box to paste a spreadsheet into, and a table underneath that checks
 * every line as it is pasted. Lines with a problem are shown and left out;
 * the rest are saved together.
 */
export function PasteImport({ action, hidden }: Props) {
  const [pasted, setPasted] = useState("");
  const { rows, tooMany } = parsePropertyRows(pasted);
  const good = rows.filter((row) => row.problems.length === 0).length;
  const bad = rows.length - good;

  return (
    <ActionForm action={action} className="space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div>
        <label htmlFor="rows" className={labelClass}>
          Paste your properties
        </label>
        <p className="-mt-1 mb-2 text-sm text-muted">
          One property per line, in this order: name, street address, suburb, postcode, how a tradie gets in. Copy the cells straight from a spreadsheet, or separate them with commas. Up to {IMPORT_MAX_ROWS}.
        </p>
        <textarea
          id="rows"
          name="rows"
          rows={8}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          className={`${inputClass} font-mono text-sm`}
          placeholder={"Lakeview Apartment, 14B Lake Esplanade, Queenstown, 9300, Lockbox code 4821\nArthurs Point Cabin, 27 Atley Road, Arthurs Point, 9371, Key safe by the back door"}
          spellCheck={false}
        />
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm" aria-label="What will be saved">
            <thead className="bg-tint text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Line</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Address</th>
                <th className="px-3 py-2 font-semibold">Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line} className="border-t border-line align-top">
                  <td className="tabular px-3 py-2 text-muted">{row.line}</td>
                  <td className="px-3 py-2 font-semibold text-ink">{row.name || "-"}</td>
                  <td className="px-3 py-2 text-ink">{[row.addressLine1, row.suburb, row.postcode].filter(Boolean).join(", ") || "-"}</td>
                  <td className={`px-3 py-2 ${row.problems.length ? "text-red-700" : "text-done"}`}>{row.problems.length ? row.problems.join(" ") : "Ready"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tooMany && <p className="text-sm font-semibold text-red-700">Only the first {IMPORT_MAX_ROWS} lines can be saved at once. Save these, then paste the rest.</p>}
      {bad > 0 && good > 0 && <p className="text-sm text-muted">{bad === 1 ? "The line with a problem is" : `The ${bad} lines with a problem are`} left out. Fix them above, or add them one at a time later.</p>}

      <SubmitButton pendingLabel="Saving..." className="w-full">
        {good === 0 ? "Save" : `Save ${good} ${good === 1 ? "property" : "properties"}`}
      </SubmitButton>
    </ActionForm>
  );
}
