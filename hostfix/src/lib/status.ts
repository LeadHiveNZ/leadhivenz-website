import "server-only";
import fs from "node:fs";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { countEditMarkers, landingFile } from "@/lib/content";
import { env, isVercel } from "@/lib/env";
import { metaPixelId, metaSettings } from "@/lib/meta/capi";
import { ALERT_SMS_FORMAT_HELP, alertEmailRecipients, alertSmsNumbers } from "@/lib/notify/alerts";
import { emailSettings, usingResendTestSender } from "@/lib/notify/email";
import { smsSettings } from "@/lib/notify/sms";
import { depositAvailability } from "@/lib/payments/deposit";
import { getStore, storeKind, supabaseSettings } from "@/lib/store";

/**
 * THE SETUP CHECKLIST shown on the admin page. Each line says, in plain words,
 * whether one part of the system is connected, and what to do if it is not.
 */

export type StatusState = "ok" | "todo" | "problem";
export type StatusItem = { key: string; label: string; state: StatusState; detail: string };

function placeholdersLeft(): { count: number; where: string[] } {
  const where: string[] = [];
  let count = 0;
  for (const kind of ["owner", "tradie"] as const) {
    try {
      const found = countEditMarkers(fs.readFileSync(landingFile(kind), "utf8"));
      if (found > 0) {
        count += found;
        where.push(`${found} in content/landing-${kind}.md`);
      }
    } catch {
      // A missing file is reported when the page itself is built.
    }
  }
  const brandFields = [brand.contact.email, brand.legalName].filter((value) => value.includes("[EDIT")).length;
  if (brandFields > 0) {
    count += brandFields;
    where.push(`${brandFields} in config/brand.ts`);
  }
  return { count, where };
}

export async function setupStatus(): Promise<StatusItem[]> {
  const items: StatusItem[] = [];

  // Database
  const kind = storeKind();
  if (kind === "supabase") {
    const health = await getStore().health();
    items.push({ key: "database", label: "Database", state: health.ok ? "ok" : "problem", detail: health.detail });
  } else if (kind === "demo") {
    items.push({
      key: "database",
      label: "Database",
      state: "todo",
      detail: "Demo mode: leads are saved in a file on this computer only. Connect Supabase before going live.",
    });
  } else {
    const settings = supabaseSettings();
    items.push({
      key: "database",
      label: "Database",
      state: "problem",
      detail: `${"problem" in settings ? settings.problem : "Not connected."} Leads cannot be saved until this is fixed.`,
    });
  }

  // Email alerts
  const email = emailSettings();
  const emailTo = alertEmailRecipients();
  if ("problem" in email) {
    items.push({ key: "email", label: "Email alerts", state: "todo", detail: email.problem });
  } else if (emailTo.length === 0) {
    items.push({ key: "email", label: "Email alerts", state: "todo", detail: "ALERT_EMAIL_TO is not set." });
  } else {
    items.push({
      key: "email",
      label: "Email alerts",
      state: "ok",
      detail:
        `Alerts go to ${emailTo.join(", ")}.` +
        (usingResendTestSender(email.settings)
          ? " Using Resend's test sender, which only delivers to the address that owns the Resend account."
          : ""),
    });
  }

  // Text alerts
  const sms = smsSettings();
  const smsTo = alertSmsNumbers();
  if ("problem" in sms) {
    items.push({ key: "sms", label: "Text alerts", state: "todo", detail: sms.problem });
  } else if (smsTo.rejected.length > 0) {
    items.push({ key: "sms", label: "Text alerts", state: "problem", detail: ALERT_SMS_FORMAT_HELP });
  } else if (smsTo.numbers.length === 0) {
    items.push({ key: "sms", label: "Text alerts", state: "todo", detail: "ALERT_SMS_TO is not set." });
  } else {
    items.push({
      key: "sms",
      label: "Text alerts",
      state: "ok",
      detail: `Texts go to ${smsTo.numbers.join(", ")} through ${sms.settings.provider === "twilio" ? "Twilio" : "ClickSend"}.`,
    });
  }

  // Card payments
  const deposit = depositAvailability(launchMarket);
  const country = launchMarket.country;
  if (!deposit.available) {
    const notStarted = /is not set|switched off/.test(deposit.reason);
    items.push({ key: "payments", label: "Card payments", state: notStarted ? "todo" : "problem", detail: deposit.reason });
  } else if (!deposit.account.webhookSecret) {
    items.push({
      key: "payments",
      label: "Card payments",
      state: "problem",
      detail: `STRIPE_${country}_WEBHOOK_SECRET is not set. Without it, a deposit is only recorded if the owner comes back to the site after paying.`,
    });
  } else if (deposit.account.mode === "test") {
    items.push({
      key: "payments",
      label: "Card payments",
      state: "todo",
      detail: "Connected in TEST mode. No real money moves. Swap in your live Stripe key and webhook secret when you are ready.",
    });
  } else {
    items.push({ key: "payments", label: "Card payments", state: "ok", detail: "Connected and taking real payments." });
  }

  // Meta
  const pixel = metaPixelId();
  items.push(
    pixel
      ? { key: "pixel", label: "Meta Pixel", state: "ok", detail: `Pixel ${pixel} is on the public pages.` }
      : {
          key: "pixel",
          label: "Meta Pixel",
          state: "todo",
          detail: env("NEXT_PUBLIC_META_PIXEL_ID")
            ? "NEXT_PUBLIC_META_PIXEL_ID should be the Pixel ID: digits only."
            : "NEXT_PUBLIC_META_PIXEL_ID is not set.",
        },
  );
  const meta = metaSettings();
  if ("problem" in meta) {
    items.push({
      key: "capi",
      label: "Meta Conversions API",
      state: "todo",
      detail: pixel ? meta.problem : "Set up the Meta Pixel first, then add META_CAPI_ACCESS_TOKEN.",
    });
  } else if (meta.settings.testEventCode) {
    items.push({
      key: "capi",
      label: "Meta Conversions API",
      state: "todo",
      detail: "Connected in test mode. Remove META_TEST_EVENT_CODE when you have finished testing.",
    });
  } else {
    items.push({ key: "capi", label: "Meta Conversions API", state: "ok", detail: "Leads and deposits are also sent to Meta from the server." });
  }

  // Page analytics
  items.push(
    isVercel()
      ? {
          key: "analytics",
          label: "Page analytics",
          state: "ok",
          detail: "Page views are counted by Vercel Web Analytics. It must also be switched on in the Vercel dashboard (Analytics, then Enable).",
        }
      : { key: "analytics", label: "Page analytics", state: "todo", detail: "Starts counting once the site is hosted on Vercel." },
  );

  // Copy
  const placeholders = placeholdersLeft();
  items.push(
    placeholders.count === 0
      ? { key: "copy", label: "Page copy", state: "ok", detail: "No [EDIT] placeholders left." }
      : {
          key: "copy",
          label: "Page copy",
          state: "todo",
          detail: `${placeholders.count} [EDIT] placeholder${placeholders.count === 1 ? "" : "s"} still to replace: ${placeholders.where.join(", ")}.`,
        },
  );

  // Legal
  items.push({
    key: "legal",
    label: "Legal pages",
    state: "todo",
    detail: "Terms, privacy, tradie agreement and insurance are placeholders. A lawyer needs to write them before you run ads or take deposits.",
  });

  return items;
}
