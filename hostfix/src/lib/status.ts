import "server-only";
import fs from "node:fs";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { now } from "@/lib/clock";
import { countEditMarkers, landingFile } from "@/lib/content";
import { env, isVercel } from "@/lib/env";
import { metaPixelId, metaSettings } from "@/lib/meta/capi";
import { ALERT_SMS_FORMAT_HELP, alertEmailRecipients, alertSmsNumbers } from "@/lib/notify/alerts";
import { emailSettings, usingResendTestSender } from "@/lib/notify/email";
import { smsSettings } from "@/lib/notify/sms";
import { depositAvailability } from "@/lib/payments/deposit";
import { databaseSettings, getDb } from "@/lib/db";
import { lastTick } from "@/lib/dispatch/tick";
import { foundingBillingLine, foundingSpotsTaken } from "@/lib/leads/founding";
import { listMarkets } from "@/lib/markets/store";
import { storageSettings } from "@/lib/files/store";
import { getStore, storeKind } from "@/lib/store";

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
  if (kind === "postgres") {
    const settings = databaseSettings();
    if ("problem" in settings) {
      items.push({ key: "database", label: "Database", state: "problem", detail: `${settings.problem} Nothing can be saved until this is fixed.` });
    } else {
      const health = await getStore().health();
      const detail =
        health.ok && settings.settings.ssl !== false && !settings.settings.ssl.rejectUnauthorized
          ? `${health.detail} The connection is encrypted. Optional extra: add DATABASE_CA_CERT so the server's identity is checked too (SETUP.md).`
          : health.detail;
      items.push({ key: "database", label: "Database", state: health.ok ? "ok" : "problem", detail });
    }
  } else if (kind === "demo") {
    items.push({
      key: "database",
      label: "Database",
      state: "todo",
      detail: "Demo mode: everything is kept in a folder on this computer only. Connect Supabase before going live.",
    });
  } else {
    items.push({
      key: "database",
      label: "Database",
      state: "problem",
      detail: "DATABASE_URL is not set. Nothing can be saved until this is fixed.",
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
    items.push({
      key: "payments", label: "Card payments", state: "ok",
      detail: "Connected and taking real payments. Paying tradies also needs Connect switched on in Stripe, and the extra webhook events ticked (SETUP.md).",
    });
  }

  // The timer
  const cronSecret = env("CRON_SECRET");
  if (kind === "demo") {
    items.push({ key: "timer", label: "The timer", state: "todo", detail: "Demo mode: the app runs its own timer every 20 seconds. On the live site Vercel runs it once a minute." });
  } else if (!cronSecret || cronSecret.length < 16) {
    items.push({
      key: "timer", label: "The timer", state: "problem",
      detail: "CRON_SECRET is not set (it needs at least 16 characters). Without it offers never move on to the next tradie, missed promises are not credited and tradies are not paid.",
    });
  } else {
    let last: Date | null = null;
    try {
      last = (await lastTick(await getDb()))?.at ?? null;
    } catch {
      // Reported by the database line above.
    }
    const minutes = last ? Math.round((now().getTime() - last.getTime()) / 60_000) : null;
    items.push(
      minutes !== null && minutes <= 5
        ? { key: "timer", label: "The timer", state: "ok", detail: `Running. It last ran ${minutes <= 1 ? "in the last minute" : `${minutes} minutes ago`}.` }
        : {
            key: "timer", label: "The timer", state: "problem",
            detail: `${minutes === null ? "It has never run." : `It last ran ${minutes} minutes ago.`} It should run every minute. Check the site is on Vercel's Pro plan and that Cron Jobs shows /api/cron/tick (SETUP.md).`,
          },
    );
  }

  // Photos
  const storage = storageSettings();
  items.push(
    "problem" in storage
      ? kind === "demo"
        ? { key: "photos", label: "Photo storage", state: "todo", detail: "Demo mode: photos are kept in a folder on this computer. Connect Supabase Storage before going live." }
        : { key: "photos", label: "Photo storage", state: "problem", detail: `${storage.problem} Until it is set, nobody can add photos, and a tradie cannot finish a job without one.` }
      : { key: "photos", label: "Photo storage", state: "ok", detail: `Photos are kept privately in the "${storage.bucket}" bucket.` },
  );

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

  // Founding members: what the page promised against what billing does.
  try {
    const db = await getDb();
    for (const market of await listMarkets(db)) {
      const line = foundingBillingLine(market, await foundingSpotsTaken(db, market.slug));
      if (line) items.push({ key: `founding-${market.slug}`, label: `Founding billing (${market.name})`, ...line });
    }
  } catch {
    // The database line above already says what is wrong.
  }

  // Legal
  items.push({
    key: "legal",
    label: "Legal pages",
    state: "todo",
    detail:
      "Terms, privacy, the tradie agreement and insurance are written in plain English from what the app does. Before the first job, have Community Law (free) read them; at around 100 properties, pay a lawyer to review them. Tick this off by hand once that is done (DECISIONS.md).",
  });

  return items;
}
