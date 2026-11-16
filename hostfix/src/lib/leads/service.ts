import { randomUUID } from "node:crypto";
import type { Market } from "@config/markets";
import { deriveSource, parseAttribution } from "@/lib/attribution";
import { normalisePhone } from "@/lib/phone";
import type { Lead, LeadIntent, LeadStore, LeadType, NewLead } from "@/lib/store/types";
import { firstFieldErrors, ownerLeadSchema, tradieLeadSchema } from "./schema";

/**
 * WHAT HAPPENS WHEN SOMEONE SUBMITS A FORM
 *
 * The one rule that matters: a real lead must never be lost.
 *   1. Robots are turned away quietly.
 *   2. The details are checked.
 *   3. The lead is saved.
 *   4. You are alerted by text and email.
 * If saving fails, the alert is sent anyway with every detail in it, so the
 * lead still reaches you. Only if saving AND alerting both fail is the visitor
 * told to try again.
 */

export type RawLeadForm = {
  fields: Record<string, unknown>;
  /** The hidden "where did they come from" field, as sent by the browser. */
  attribution: unknown;
  /** A field real people never see. Robots fill it in. */
  honeypot: unknown;
  /** When the browser showed the form, in milliseconds. */
  startedAt: unknown;
};

export type AlertSummary = { anySent: boolean };

export type SubmitDeps = {
  /** May throw if the database is not connected. */
  getStore: () => LeadStore;
  sendLeadAlert: (lead: Lead, options: { saved: boolean }, store: LeadStore | null) => Promise<AlertSummary>;
  /** Runs work after the visitor has their answer, so they are not kept waiting. */
  defer: (work: () => Promise<void>) => void;
  now?: () => Date;
  log?: Pick<Console, "error" | "warn">;
};

export type SubmitContext = {
  market: Market;
  /** A scrambled form of the visitor's network address, for rate limiting only. */
  ipKey: string | null;
};

export type SubmitResult =
  | { status: "ok"; lead: Lead; saved: boolean; duplicate: boolean }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "spam" }
  | { status: "rate_limited" }
  | { status: "failed" };

/** A person cannot read and fill in the form faster than this. */
export const MIN_FILL_MS = 1500;
/** Each visitor may send this many forms... */
export const RATE_LIMIT_MAX = 6;
/** ...in this many seconds. */
export const RATE_LIMIT_WINDOW_SECONDS = 600;
/** The same phone number sent again inside this window is treated as one lead. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function looksLikeRobot(form: RawLeadForm, now: Date): boolean {
  if (typeof form.honeypot === "string" && form.honeypot.trim() !== "") return true;

  const started = typeof form.startedAt === "string" ? Number(form.startedAt) : NaN;
  if (Number.isFinite(started) && started > 0) {
    const elapsed = now.getTime() - started;
    // Ignore clocks that are clearly wrong (in the future, or more than a day old).
    if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000 && elapsed < MIN_FILL_MS) return true;
  }
  return false;
}

function emptyAttributionFields() {
  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    fbclid: null,
    gclid: null,
    refCode: null,
    referrer: null,
    landingPath: null,
  };
}

/** Which button an owner pressed. Anything else (an older form, a robot) is treated as not knowing. */
export function readIntent(value: unknown): LeadIntent | null {
  return value === "deposit" || value === "pricelist" ? value : null;
}

/** Checks the form and turns it into a lead ready to save, or says what is wrong. */
export function buildLead(
  leadType: LeadType,
  form: RawLeadForm,
  market: Market,
): { lead: NewLead } | { fieldErrors: Record<string, string> } {
  const attribution = parseAttribution(form.attribution);
  const shared = {
    market: market.slug,
    source: deriveSource(attribution),
    ...emptyAttributionFields(),
    utmSource: attribution.utm_source ?? null,
    utmMedium: attribution.utm_medium ?? null,
    utmCampaign: attribution.utm_campaign ?? null,
    utmContent: attribution.utm_content ?? null,
    utmTerm: attribution.utm_term ?? null,
    fbclid: attribution.fbclid ?? null,
    gclid: attribution.gclid ?? null,
    refCode: attribution.ref ?? null,
    referrer: attribution.referrer ?? null,
    landingPath: attribution.landing_path ?? null,
  };

  if (leadType === "owner") {
    const parsed = ownerLeadSchema.safeParse(form.fields);
    const fieldErrors = parsed.success ? {} : firstFieldErrors(parsed.error);
    const rawPhone = typeof form.fields.phone === "string" ? form.fields.phone : "";
    const phone = normalisePhone(rawPhone, market.country);
    if (!phone && !fieldErrors.phone) fieldErrors.phone = "That phone number doesn't look right. Please check it.";
    if (!parsed.success || !phone) return { fieldErrors };

    return {
      lead: {
        ...shared,
        leadType: "owner",
        name: parsed.data.name,
        phone: phone.e164,
        email: parsed.data.email,
        propertyCount: parsed.data.propertyCount,
        managedBy: parsed.data.managedBy,
        ownerLocation: parsed.data.ownerLocation,
        intent: readIntent(form.fields.intent),
        trade: null,
        licenceNumber: null,
        daysAvailable: null,
      },
    };
  }

  const parsed = tradieLeadSchema.safeParse(form.fields);
  const fieldErrors = parsed.success ? {} : firstFieldErrors(parsed.error);
  const rawPhone = typeof form.fields.phone === "string" ? form.fields.phone : "";
  const phone = normalisePhone(rawPhone, market.country);
  if (!phone && !fieldErrors.phone) fieldErrors.phone = "That phone number doesn't look right. Please check it.";
  if (!parsed.success || !phone) return { fieldErrors };

  return {
    lead: {
      ...shared,
      leadType: "tradie",
      name: parsed.data.name,
      phone: phone.e164,
      email: null,
      propertyCount: null,
      managedBy: null,
      ownerLocation: null,
      intent: null,
      trade: parsed.data.trade,
      licenceNumber: parsed.data.licenceNumber,
      daysAvailable: parsed.data.daysAvailable,
    },
  };
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function submitLead(
  leadType: LeadType,
  form: RawLeadForm,
  context: SubmitContext,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? console;

  if (looksLikeRobot(form, now)) return { status: "spam" };

  const built = buildLead(leadType, form, context.market);
  if ("fieldErrors" in built) return { status: "invalid", fieldErrors: built.fieldErrors };
  const newLead = built.lead;

  let store: LeadStore | null = null;
  try {
    store = deps.getStore();
  } catch (error) {
    log.error("[leads] the database is not available:", reason(error));
  }

  if (store) {
    // Two quick checks come first. If either one breaks, the database is
    // probably struggling, so skip the rest of the checks and go straight to
    // saving: a real lead matters more than a perfect check.
    let checksWorking = true;

    if (context.ipKey) {
      try {
        const allowed = await store.rateLimitHit(`lead:${context.ipKey}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX);
        if (!allowed) return { status: "rate_limited" };
      } catch (error) {
        checksWorking = false;
        log.warn("[leads] rate limit check failed, continuing:", reason(error));
      }
    }

    // The same person pressing the button twice is one lead, and one alert.
    if (checksWorking) {
      try {
        const since = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
        const existing = await store.findRecentLead(leadType, newLead.phone, since);
        if (existing) {
          // The same person again. If they now want a founding spot, remember that.
          let lead = existing;
          if (newLead.intent && newLead.intent !== existing.intent) {
            try {
              lead = (await store.recordIntent(existing.id, newLead.intent)) ?? existing;
            } catch (error) {
              log.warn("[leads] could not update which button was pressed:", reason(error));
            }
          }
          return { status: "ok", lead, saved: true, duplicate: true };
        }
      } catch (error) {
        log.warn("[leads] repeat check failed, continuing:", reason(error));
      }
    }

    try {
      const lead = await store.insertLead(newLead);
      const savedStore = store;
      deps.defer(async () => {
        try {
          await deps.sendLeadAlert(lead, { saved: true }, savedStore);
        } catch (error) {
          log.error("[leads] alert failed for a saved lead:", reason(error));
        }
      });
      return { status: "ok", lead, saved: true, duplicate: false };
    } catch (error) {
      log.error("[leads] SAVING A LEAD FAILED:", reason(error));
    }
  }

  // Saving failed. The alert is now the only copy, so wait for it.
  const unsaved: Lead = {
    ...newLead,
    id: randomUUID(),
    createdAt: now.toISOString(),
    depositStatus: "none",
    depositAmount: null,
    depositCurrency: null,
    stripeAccount: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    depositPaidAt: null,
    depositRefundedAt: null,
    convertedAt: null,
    invitedAt: null,
  };
  try {
    const outcome = await deps.sendLeadAlert(unsaved, { saved: false }, null);
    if (outcome.anySent) return { status: "ok", lead: unsaved, saved: false, duplicate: false };
  } catch (error) {
    log.error("[leads] alert failed for an unsaved lead:", reason(error));
  }
  log.error("[leads] A LEAD WAS LOST: it could not be saved and no alert could be sent.");
  return { status: "failed" };
}
