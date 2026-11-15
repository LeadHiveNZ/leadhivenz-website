"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { ActionForm, Area, Field } from "../forms/ActionForm";
import { PhotoUploader } from "../forms/PhotoUploader";
import { SubmitButton } from "../forms/SubmitButton";
import { inputClass, labelClass } from "../forms/styles";
import { Icon } from "../ui/Icon";

export type ReportItem = { id: string; name: string; tradeLabel: string; ownerCents: number; tryFirst: string };

type Props = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Sent along with the form: which property, or which report link. */
  hidden: Record<string, string>;
  /** owner and team see prices and choose urgency. A guest sees neither. */
  audience: "owner" | "team" | "guest";
  items: ReportItem[];
  offMenuTrades: { key: string; label: string }[];
  currency: string;
  diagnosisCents: number;
  standardHours: number;
  urgentHours: number;
  urgentCents: number;
  /** True when this property's membership covers the urgent surcharge right now. */
  urgentIncluded: boolean;
  /** True when it is outside working hours right now, so an urgent job also carries the after-hours surcharge. */
  afterHoursNow: boolean;
  afterHoursCents: number;
  /** The report link, for people who are not signed in, so their photos are accepted. */
  uploadToken?: string;
};

const OFF_MENU = "off-menu";

/**
 * Report a problem. One screen, top to bottom: what is wrong, how urgent,
 * anything worth knowing, photos, send. The price is worked out here so the
 * person sees it before they commit, and again on the server when it is sent,
 * which is the one that counts.
 */
export function ReportForm(props: Props) {
  const { audience, items, currency } = props;
  const [choice, setChoice] = useState<string>("");
  const [urgent, setUrgent] = useState(false);
  const showPrices = audience !== "guest";
  const selected = items.find((item) => item.id === choice) ?? null;
  const base = choice === OFF_MENU ? props.diagnosisCents : (selected?.ownerCents ?? 0);
  const urgentExtra = urgent ? (props.urgentIncluded ? 0 : props.urgentCents) + (props.afterHoursNow ? props.afterHoursCents : 0) : 0;
  const total = base + urgentExtra;

  const groups = new Map<string, ReportItem[]>();
  for (const item of items) groups.set(item.tradeLabel, [...(groups.get(item.tradeLabel) ?? []), item]);

  const optionClass = (on: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${on ? "border-brand bg-tint ring-2 ring-brand/20" : "border-line bg-white hover:border-brand/40"}`;

  return (
    <ActionForm action={props.action} className="space-y-6">
      {Object.entries(props.hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <fieldset>
        <legend className="display text-2xl text-ink">What needs fixing?</legend>
        <div className="mt-3 space-y-5">
          {[...groups.entries()].map(([label, group]) => (
            <div key={label}>
              <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{label}</p>
              <div className="space-y-2">
                {group.map((item) => (
                  <label key={item.id} className={optionClass(choice === item.id)}>
                    <input type="radio" name="menuItemId" value={item.id} checked={choice === item.id} onChange={() => setChoice(item.id)} className="h-5 w-5 shrink-0 accent-[var(--hf-brand)]" required />
                    <span className="flex-1 font-semibold text-ink">{item.name}</span>
                    {showPrices && <span className="tabular shrink-0 font-bold text-ink">{formatMoney(item.ownerCents, currency)}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Not on the list</p>
            <label className={optionClass(choice === OFF_MENU)}>
              <input type="radio" name="menuItemId" value={OFF_MENU} checked={choice === OFF_MENU} onChange={() => setChoice(OFF_MENU)} className="h-5 w-5 shrink-0 accent-[var(--hf-brand)]" required />
              <span className="flex-1">
                <span className="block font-semibold text-ink">Something else</span>
                {showPrices && <span className="block text-sm text-muted">A tradie comes to look, then prices the work before doing it.</span>}
              </span>
              {showPrices && <span className="tabular shrink-0 font-bold text-ink">{formatMoney(props.diagnosisCents, currency)}</span>}
            </label>
          </div>
        </div>
      </fieldset>

      {selected?.tryFirst && (
        <div className="flex gap-3 rounded-2xl border border-go/25 bg-go-soft px-4 py-3">
          <Icon name="bolt" className="mt-0.5 text-go" />
          <p className="text-ink">
            <span className="font-bold">Worth trying first: </span>
            {selected.tryFirst}
          </p>
        </div>
      )}

      {choice === OFF_MENU && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <Field label="In a few words, what is wrong?" name="offMenuTitle" required maxLength={100} placeholder="Water coming through the ceiling" />
          <div>
            <label htmlFor="offMenuTrade" className={labelClass}>
              What kind of problem is it?
            </label>
            <select id="offMenuTrade" name="offMenuTrade" className={`${inputClass} border-line`} defaultValue="handyman">
              {props.offMenuTrades.map((trade) => (
                <option key={trade.key} value={trade.key}>
                  {trade.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {audience === "guest" ? (
        <label className={optionClass(urgent)}>
          <input type="checkbox" name="urgent" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--hf-brand)]" />
          <span>
            <span className="block font-semibold text-ink">This is urgent</span>
            <span className="block text-sm text-muted">No water, no power, flooding, or you cannot lock the door.</span>
          </span>
        </label>
      ) : (
        <fieldset>
          <legend className="display text-2xl text-ink">How soon?</legend>
          <div className="mt-3 space-y-2">
            <label className={optionClass(!urgent)}>
              <input type="radio" name="urgent" value="" checked={!urgent} onChange={() => setUrgent(false)} className="h-5 w-5 shrink-0 accent-[var(--hf-brand)]" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">Standard</span>
                <span className="block text-sm text-muted">A tradie on site within {props.standardHours} hours.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-muted">No extra</span>
            </label>
            <label className={optionClass(urgent)}>
              <input type="radio" name="urgent" value="on" checked={urgent} onChange={() => setUrgent(true)} className="h-5 w-5 shrink-0 accent-[var(--hf-brand)]" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">Urgent</span>
                <span className="block text-sm text-muted">
                  A tradie on site within {props.urgentHours} hours.
                  {props.afterHoursNow ? " It is outside working hours now, so the after-hours call-out applies too." : ""}
                </span>
              </span>
              <span className="tabular shrink-0 text-right text-sm font-bold text-ink">
                {props.urgentIncluded && !props.afterHoursNow ? "Included" : `+${formatMoney((props.urgentIncluded ? 0 : props.urgentCents) + (props.afterHoursNow ? props.afterHoursCents : 0), currency)}`}
              </span>
            </label>
          </div>
        </fieldset>
      )}

      <Area label="Anything the tradie should know?" name="description" rows={3} maxLength={1500} placeholder="Which room, what you have tried, when it started." />

      <PhotoUploader kind="report" label="Photos (they help the tradie bring the right parts)" token={props.uploadToken} max={6} />

      {audience !== "owner" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="reporterName" required maxLength={60} autoComplete="name" />
          <Field label="Your mobile (optional)" name="reporterPhone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} hint="So we can text you when a tradie is booked." />
        </div>
      )}

      {showPrices && choice !== "" && (
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-4 text-white">
          <span>
            <span className="block text-sm text-white/75">{choice === OFF_MENU ? "To come and look" : "Fixed price"}</span>
            <span className="block text-sm text-white/75">Charged to the card on file when the job is done.</span>
          </span>
          <span className="tabular display text-3xl">{formatMoney(total, currency)}</span>
        </div>
      )}

      <SubmitButton pendingLabel="Sending..." className="w-full">
        {audience === "guest" ? "Report it" : "Send a tradie"}
      </SubmitButton>
    </ActionForm>
  );
}
