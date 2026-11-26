"use client";

import { useState, type ReactNode } from "react";
import type { FormState } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { NOT_SURE_TRADE } from "@config/trades";
import { ActionForm, Area, Field } from "../forms/ActionForm";
import { PhotoUploader } from "../forms/PhotoUploader";
import { SubmitButton } from "../forms/SubmitButton";
import { labelClass } from "../forms/styles";
import { Icon } from "../ui/Icon";

export type ReportItem = { id: string; name: string; trade: string; tradeLabel: string; ownerCents: number; tryFirst: string };

type Urgency = "standard" | "urgent" | "emergency";

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
  /** Emergency (DECISIONS.md, 2026-11-26, third entry): on site within this many minutes, for this much more. Never included. */
  emergencyMinutes: number;
  emergencyCents: number;
  /**
   * By trade: is anyone who could take it inside their own hours right now? If not, Urgent and Emergency are not
   * offered for that trade and `words` says when tradies' hours begin. Standard can always be booked.
   */
  cover: Record<string, { onNow: boolean; words: string | null }>;
  /** The report link, for people who are not signed in, so their photos are accepted. */
  uploadToken?: string;
  /** A team member on their own link: the report is signed with this name, so they are not asked for it. */
  signedAs?: string;
  /** Their owner asked to say yes first: nobody is sent until the owner does. */
  asksOwner?: boolean;
};

const OFF_MENU = "off-menu";

const rowClass = (on: boolean) =>
  `flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? "border-brand bg-tint ring-2 ring-brand/20" : "border-line bg-white hover:border-brand/40"}`;
const tileClass = (on: boolean) =>
  `rounded-2xl border px-4 py-3 text-left transition ${on ? "border-brand bg-tint ring-2 ring-brand/20" : "border-line bg-white hover:border-brand/40"}`;

/**
 * One choice in a list. These are drawn here rather than being the browser's
 * own radio buttons and tick boxes, because the browser clears those when a
 * form comes back with something to fix, and the person would have to choose
 * again. What is chosen is sent with the form by the hidden fields below.
 */
function Choice({ kind = "radio", on, onPick, children }: { kind?: "radio" | "checkbox"; on: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button type="button" role={kind} aria-checked={on} onClick={onPick} className={rowClass(on)}>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${kind === "radio" ? "rounded-full" : "rounded-md"} ${on ? "border-brand bg-brand text-white" : "border-muted/50 bg-white"}`}
      >
        {on && (kind === "radio" ? <span className="h-2 w-2 rounded-full bg-white" /> : <Icon name="check" size={14} />)}
      </span>
      {children}
    </button>
  );
}

/**
 * Report a problem. One screen, top to bottom: what is wrong, how urgent,
 * anything worth knowing, photos, send. The price is worked out here so the
 * person sees it before they commit, and again on the server when it is sent,
 * which is the one that counts.
 */
export function ReportForm(props: Props) {
  const { audience, items, currency } = props;
  const [choice, setChoice] = useState<string>("");
  /** Which kind of problem is opened up: a trade's label, or "off-menu". */
  const [open, setOpen] = useState<string>("");
  const [chosenUrgency, setUrgency] = useState<Urgency>("standard");
  // Guests in the house (DECISIONS.md, 2026-11-20, second entry). The let-in answer follows the guest answer until it is changed by hand.
  const [guest, setGuest] = useState<"" | "yes" | "no" | "not_sure">("");
  const [letIn, setLetIn] = useState<boolean | null>(null);
  const mayLetIn = letIn ?? !(guest === "yes" || guest === "not_sure");
  // "Not sure" until the person picks a trade: our team then picks it (DECISIONS.md, 2026-11-24).
  const [offTrade, setOffTrade] = useState<string>(props.offMenuTrades.some((trade) => trade.key === NOT_SURE_TRADE) ? NOT_SURE_TRADE : (props.offMenuTrades[0]?.key ?? NOT_SURE_TRADE));
  const showPrices = audience !== "guest";
  const selected = items.find((item) => item.id === choice) ?? null;
  // Who is on right now for this trade (DECISIONS.md, 2026-11-26, third entry). Nobody: only Standard is offered.
  const trade = selected?.trade ?? (choice === OFF_MENU ? offTrade : null);
  const cover = trade ? props.cover[trade] : undefined;
  const rushOffered = !cover || cover.onNow;
  const urgency: Urgency = audience === "guest" || rushOffered ? chosenUrgency : "standard";
  const urgent = urgency !== "standard";
  const base = choice === OFF_MENU ? props.diagnosisCents : (selected?.ownerCents ?? 0);
  const afterHoursExtra = props.afterHoursNow ? props.afterHoursCents : 0;
  const urgentExtra = (props.urgentIncluded ? 0 : props.urgentCents) + afterHoursExtra;
  const emergencyExtra = props.emergencyCents + afterHoursExtra;
  const total = base + (urgency === "urgent" ? urgentExtra : urgency === "emergency" ? emergencyExtra : 0);

  const groups = new Map<string, ReportItem[]>();
  for (const item of items) groups.set(item.tradeLabel, [...(groups.get(item.tradeLabel) ?? []), item]);

  return (
    <ActionForm action={props.action} className="space-y-6">
      {Object.entries(props.hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* What has been chosen, sent with the form. */}
      <input type="hidden" name="menuItemId" value={choice} />
      <input type="hidden" name="urgent" value={urgent ? "on" : ""} />
      <input type="hidden" name="urgency" value={urgency} />
      <input type="hidden" name="offMenuTrade" value={offTrade} />

      <fieldset>
        <legend className="display text-2xl text-ink">What needs fixing?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[...groups.entries()].map(([label, group]) => (
            <button
              key={label}
              type="button"
              aria-pressed={open === label}
              onClick={() => {
                setOpen(label);
                if (selected?.tradeLabel !== label) setChoice("");
              }}
              className={tileClass(open === label)}
            >
              <span className="block font-bold text-ink">{label}</span>
              <span className="block text-sm text-muted">
                {group.length} {group.length === 1 ? "job" : "jobs"}
              </span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={open === OFF_MENU}
            onClick={() => {
              setOpen(OFF_MENU);
              setChoice(OFF_MENU);
            }}
            className={tileClass(open === OFF_MENU)}
          >
            <span className="block font-bold text-ink">Something else</span>
            <span className="block text-sm text-muted">{showPrices ? `Not on the list. ${formatMoney(props.diagnosisCents, currency)} to come and look` : "Not on the list"}</span>
          </button>
        </div>

        {open && open !== OFF_MENU && (
          <div className="mt-4" role="radiogroup" aria-label={open}>
            <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{open}</p>
            <div className="space-y-2">
              {(groups.get(open) ?? []).map((item) => (
                <Choice key={item.id} on={choice === item.id} onPick={() => setChoice(item.id)}>
                  <span className="flex-1 font-semibold text-ink">{item.name}</span>
                  {showPrices && <span className="tabular shrink-0 font-bold text-ink">{formatMoney(item.ownerCents, currency)}</span>}
                </Choice>
              ))}
            </div>
          </div>
        )}
        {open === OFF_MENU && showPrices && (
          <p className="mt-3 text-sm text-muted">A tradie comes to look, then prices the work before doing it. You only pay the call-out unless you say yes to their price.</p>
        )}
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
          <div role="radiogroup" aria-label="What kind of problem is it?">
            <p className={labelClass}>What kind of problem is it?</p>
            <p className="-mt-1 mb-2 text-sm text-muted">Not sure? Leave it on &ldquo;Not sure&rdquo; and our team picks the right tradie.</p>
            <div className="flex flex-wrap gap-2">
              {props.offMenuTrades.map((trade) => (
                <button
                  key={trade.key}
                  type="button"
                  role="radio"
                  aria-checked={offTrade === trade.key}
                  onClick={() => setOffTrade(trade.key)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${offTrade === trade.key ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand/40"}`}
                >
                  {trade.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {audience === "guest" ? (
        <Choice kind="checkbox" on={urgent} onPick={() => setUrgency(urgent ? "standard" : "urgent")}>
          <span>
            <span className="block font-semibold text-ink">This is urgent</span>
            <span className="block text-sm text-muted">No water, no power, flooding, or you cannot lock the door.</span>
          </span>
        </Choice>
      ) : (
        <fieldset>
          <legend className="display text-2xl text-ink">How soon?</legend>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="How soon?">
            <Choice on={urgency === "standard"} onPick={() => setUrgency("standard")}>
              <span className="flex-1">
                <span className="block font-semibold text-ink">Standard</span>
                <span className="block text-sm text-muted">A tradie on site within {props.standardHours} hours. They tell you when, as they accept.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-muted">No extra</span>
            </Choice>
            {rushOffered ? (
              <>
                <Choice on={urgency === "urgent"} onPick={() => setUrgency("urgent")}>
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">Urgent: within {props.urgentHours} hours</span>
                    <span className="block text-sm text-muted">
                      The tradie drops what they are doing to come.{" "}
                      {props.urgentIncluded ? "Included in your membership." : `${formatMoney(props.urgentCents, currency)} more, not charged if they get there late.`}
                    </span>
                    {props.afterHoursNow && (
                      <span className="block text-sm text-muted">
                        It is outside working hours now, so the after-hours call-out adds {formatMoney(props.afterHoursCents, currency)}, charged only if the tradie arrives outside working hours.
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-right text-sm font-bold text-ink">{urgentExtra === 0 ? "Included" : `+${formatMoney(urgentExtra, currency)}`}</span>
                </Choice>
                <Choice on={urgency === "emergency"} onPick={() => setUrgency("emergency")}>
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">Emergency: within {props.emergencyMinutes === 60 ? "1 hour" : `${props.emergencyMinutes} minutes`}</span>
                    <span className="block text-sm text-muted">
                      Flooding, no power, can&rsquo;t lock up. Sent to every tradie who is on, at once. {formatMoney(props.emergencyCents, currency)} more, not charged if they get there late.
                    </span>
                    {props.afterHoursNow && (
                      <span className="block text-sm text-muted">
                        Plus the after-hours call-out, {formatMoney(props.afterHoursCents, currency)}, charged only if the tradie arrives outside working hours.
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-right text-sm font-bold text-ink">+{formatMoney(emergencyExtra, currency)}</span>
                </Choice>
              </>
            ) : (
              <p className="rounded-xl bg-tint px-4 py-3 text-ink">{cover?.words ?? "No one is on right now."} Standard can still be booked now.</p>
            )}
          </div>
        </fieldset>
      )}

      <Area label="Anything the tradie should know?" name="description" rows={3} maxLength={1500} placeholder="Which room, what you have tried, when it started." />

      <PhotoUploader kind="report" label="Photos (they help the tradie bring the right parts)" token={props.uploadToken} max={6} />

      {audience !== "guest" && (
        <fieldset className="space-y-2.5">
          <legend className={labelClass}>Is a guest staying at the time?</legend>
          <input type="hidden" name="guestStaying" value={guest} />
          <input type="hidden" name="mayLetIn" value={mayLetIn ? "yes" : "no"} />
          <div className="grid gap-2 sm:grid-cols-3">
            {([["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] as const).map(([value, label]) => (
              <Choice key={value} on={guest === value} onPick={() => setGuest(value)}>
                <span className="font-semibold text-ink">{label}</span>
              </Choice>
            ))}
          </div>
          {(guest === "yes" || guest === "not_sure") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Guest's first name (optional)" name="guestName" maxLength={40} autoComplete="off" />
              <Field label="Guest's mobile (optional)" name="guestPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" hint="We text them when the tradie is booked and on the way, and use the number for nothing else." />
            </div>
          )}
          <Choice kind="checkbox" on={mayLetIn} onPick={() => setLetIn(!mayLetIn)}>
            <span>
              <span className="block font-semibold text-ink">If nobody answers, the tradie may let themselves in</span>
              <span className="block text-sm text-muted">With a guest staying, the tradie always knocks and waits first.</span>
            </span>
          </Choice>
        </fieldset>
      )}

      {props.signedAs && (
        <p className="rounded-xl bg-tint px-4 py-3 text-ink">
          Sent as <strong>{props.signedAs}</strong>. {props.asksOwner ? "The owner gets a text to say yes before anyone is sent." : "The owner gets a text to say it is on its way."}
        </p>
      )}

      {audience !== "owner" && !props.signedAs && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="reporterName" required maxLength={60} autoComplete="name" />
          <Field label="Your mobile (optional)" name="reporterPhone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} hint="So we can text you when a tradie is booked." />
        </div>
      )}

      {showPrices && choice !== "" && (
        <div className="on-dark flex items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-4 text-white">
          <span>
            <span className="block text-sm text-white/75">{choice === OFF_MENU ? "To come and look" : "Fixed price"}</span>
            {/* The hold on the card at booking (DECISIONS.md, 2026-11-23). A team member asking the owner first holds nothing yet. */}
            <span className="block text-sm text-white/75">
              {props.asksOwner ? "Held on the owner's card once they say yes. Only charged once it's fixed." : audience === "owner" ? `We hold ${formatMoney(total, currency)} on your card now. You're only charged once it's fixed.` : `We hold ${formatMoney(total, currency)} on the owner's card now. They're only charged once it's fixed.`}
            </span>
          </span>
          <span className="tabular display text-3xl">{formatMoney(total, currency)}</span>
        </div>
      )}

      {choice === "" && <p className="text-center text-sm text-muted">Choose what needs fixing above, then send.</p>}
      <SubmitButton pendingLabel="Sending..." className="w-full">
        {audience === "guest" ? "Report it" : props.asksOwner ? "Send to the owner" : "Send a tradie"}
      </SubmitButton>
    </ActionForm>
  );
}
