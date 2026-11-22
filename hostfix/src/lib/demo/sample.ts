import { addStaff } from "@/lib/auth/staff";
import { chargeJob, markMissedWindows, raiseDispute, releaseDuePayouts, type GatewayFor } from "@/lib/billing/settle";
import { DAY, HOUR, MINUTE, setTestNow } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { acceptOffer, expireDueOffers, passOffer } from "@/lib/dispatch/cascade";
import type { FileStore } from "@/lib/files/store";
import { newStorageKey, recordUpload, type UploadKind } from "@/lib/files/uploads";
import { createJob, type NewJob } from "@/lib/jobs/create";
import type { Job } from "@/lib/jobs/types";
import { completeJob, markArrived, markEnRoute, submitQuote } from "@/lib/jobs/work";
import { addParts, attachReceipt, listPriceList, requestReceipt } from "@/lib/jobs/parts";
import { updateMarket } from "@/lib/markets/admin";
import { listMenu, listTiers } from "@/lib/markets/store";
import { flushOutbox } from "@/lib/notify/outbox";
import { resolveException } from "@/lib/ops/exceptions";
import { registerReferrer } from "@/lib/owners/referrers";
import { createOwnerAccount, saveBilling } from "@/lib/owners/service";
import { createDemoGateway, DEMO_CARD_DECLINES, DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import { addMonths } from "@/lib/payments/gateway";
import { openPortfolio, startPortfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, activateMembership, createProperty, type Property } from "@/lib/properties/service";
import { confirmPin } from "@/lib/properties/pin";
import { addTeamMember } from "@/lib/team/service";
import { agreeToAgreement, createTradie, listLicences, markLicenceVerified, saveLicence, savePayoutAccount, setSlot, setTradieStatus, updateTradie } from "@/lib/tradies/service";
import { recordInsuranceCertificate } from "@/lib/tradies/certificate";
import { demoPhoto } from "./png";

/**
 * SAMPLE DATA FOR THE DEMO. The first time the app starts in demo mode it
 * makes up a small, believable business: three owners, one property manager
 * on Portfolio, five tradies and nine jobs, each stopped at a different point,
 * so every screen has something on it.
 *
 * Nothing here is written straight into the database. Every owner, property,
 * job, payment and text is created by calling the same functions the live app
 * uses, in order, with the clock wound back. So the demo cannot show anything
 * the real app could not do.
 *
 * It only ever runs on a computer in demo mode, never on the live site.
 */

export type DemoPerson = { key: string; label: string; role: "owner" | "tradie" | "dispatcher" | "admin" | "cleaner" | "guest"; userId: string | null; phone: string | null; note: string };

const MARKET = "queenstown";
const EVERY_DAY = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type Ctx = { db: Db; gatewayFor: GatewayFor; files: FileStore | null; real: Date; menu: Map<string, string>; tiers: Map<string, { id: string; priceCents: number }> };

/** Winds the app's clock to a moment before now. */
function ago(ctx: Ctx, ms: number): void {
  setTestNow(new Date(ctx.real.getTime() - ms));
}

async function picture(ctx: Ctx, uploadedBy: string, kind: UploadKind, look: "before" | "after" | "found"): Promise<string> {
  const bytes = demoPhoto(look);
  const key = newStorageKey(kind, "png");
  await ctx.files?.put(key, bytes, "image/png");
  const upload = await recordUpload(ctx.db, { kind, storageKey: key, contentType: "image/png", bytes: bytes.byteLength, uploadedBy });
  return upload.id;
}

async function owner(ctx: Ctx, input: { name: string; email: string; phone: string; home: string; card: "ok" | "declines" }) {
  const created = await createOwnerAccount(ctx.db, { name: input.name, email: input.email, phone: input.phone, homeLocation: input.home });
  await saveBilling(ctx.db, {
    ownerId: created.ownerId, country: "NZ", provider: "demo", customerId: `demo_cus_${created.ownerId.replace(/-/g, "").slice(0, 16)}`,
    card: input.card === "declines" ? DEMO_CARD_DECLINES : DEMO_CARD_OK,
  });
  return created;
}

async function property(
  ctx: Ctx, ownerId: string,
  input: { name: string; address: string; suburb: string; postcode: string; access: string; referralCode?: string; pin: { lat: number; lng: number } },
): Promise<Property> {
  // Owners are on Essential, free to join (DECISIONS.md, 2026-11-17): covered once a card is on file.
  const tier = ctx.tiers.get("essential")!;
  const created = await createProperty(ctx.db, ownerId, {
    market: MARKET, name: input.name, addressLine1: input.address, suburb: input.suburb, postcode: input.postcode, accessNotes: input.access,
    tierId: tier.id, referralCode: input.referralCode ?? null,
  });
  // The owner put the pin on the house (DECISIONS.md, 2026-11-19). The manager's ten have not been checked yet.
  await confirmPin(ctx.db, ownerId, created.id, { ...input.pin, moved: true });
  const at = new Date(ctx.real.getTime() - 20 * DAY);
  setTestNow(at);
  if (tier.priceCents === 0) {
    const covered = await activateFreeMembership(ctx.db, {
      propertyId: created.id, ownerId, provider: "demo", customerId: `demo_cus_${ownerId.replace(/-/g, "").slice(0, 16)}`, card: null,
    });
    return covered!;
  }
  const activated = await activateMembership(ctx.db, {
    propertyId: created.id, provider: "demo", subscriptionId: `demo_sub_${created.id.replace(/-/g, "").slice(0, 14)}`, periodEnd: addMonths(at, 1),
    customerId: `demo_cus_${ownerId.replace(/-/g, "").slice(0, 16)}`, card: null,
    invoice: { invoiceId: `demo_in_${created.id.replace(/-/g, "").slice(0, 14)}`, amountCents: tier.priceCents, currency: "NZD", periodStart: at, periodEnd: addMonths(at, 1), paidAt: at },
  });
  return activated!;
}

async function tradie(
  ctx: Ctx,
  input: { name: string; business: string; phone: string; email: string; trades: string[]; afterHours: boolean; licences?: Record<string, string>; approve?: boolean; notes?: string },
) {
  const created = await createTradie(ctx.db, {
    name: input.name, phone: input.phone, email: input.email, market: MARKET, businessName: input.business, trades: input.trades,
    daysAvailable: EVERY_DAY, afterHours: input.afterHours, gstRegistered: true, gstNumber: "123-456-789", licences: [],
  });
  for (const [trade, expiresOn] of Object.entries(input.licences ?? {})) {
    await saveLicence(ctx.db, created.tradieId, { trade, licenceNumber: `${trade.slice(0, 2).toUpperCase()}${Math.abs(hash(input.phone + trade)) % 90000 + 10000}`, expiresOn }, "admin");
  }
  // Every tradie on the network has public liability insurance on file (DECISIONS.md, 2026-11-17).
  await updateTradie(ctx.db, created.tradieId, {
    insurer: "Sample Insurance Co", insurancePolicyNumber: `PL${Math.abs(hash(input.phone)) % 900000 + 100000}`, insuranceExpiresOn: "2027-09-30",
  }, "admin");
  // And, for everyone already approved, the certificate from their insurer uploaded (a stand-in
  // picture in the demo). A tradie still waiting shows the admin what is missing.
  if (input.approve !== false) {
    const certificateBytes = demoPhoto("found");
    const certificateKey = newStorageKey("insurance_certificate", "png");
    await ctx.files?.put(certificateKey, certificateBytes, "image/png");
    await recordInsuranceCertificate(ctx.db, { tradieId: created.tradieId }, {
      storageKey: certificateKey, contentType: "image/png", bytes: certificateBytes.byteLength, uploadedBy: `tradie:${created.tradieId}`, actor: `tradie:${created.tradieId}`,
    });
  }
  if (input.approve !== false) {
    for (const licence of await listLicences(ctx.db, created.tradieId)) await markLicenceVerified(ctx.db, licence.id, "admin");
    await savePayoutAccount(ctx.db, created.tradieId, { provider: "demo", accountId: `demo_acct_${created.tradieId.replace(/-/g, "").slice(0, 16)}`, payoutsEnabled: true });
    await setTradieStatus(ctx.db, created.tradieId, "approved", "admin");
    await agreeToAgreement(ctx.db, created.tradieId);
  }
  if (input.notes) await ctx.db.query("update public.tradies set notes = $2 where id = $1::uuid", [created.tradieId, input.notes]);
  return { ...created, phone: input.phone };
}

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) | 0;
  return value;
}

async function log(ctx: Ctx, place: Property, input: Partial<NewJob> & { code?: string; photos?: number }): Promise<Job> {
  const { code, photos = 0, ...rest } = input;
  const reportedBy = rest.reportedBy ?? "owner";
  const uploader = reportedBy === "owner" ? `owner:${place.ownerId}` : `report:${place.id}`;
  const uploadIds: string[] = [];
  for (let index = 0; index < photos; index += 1) uploadIds.push(await picture(ctx, uploader, "report", "before"));
  const result = await createJob(ctx.db, {
    property: place, reportedBy, reporterName: null, reporterPhone: null, menuItemId: code ? ctx.menu.get(code)! : null, description: "", urgent: false,
    uploadIds, uploader, actor: reportedBy === "owner" ? `owner:${place.ownerId}` : `${reportedBy}:${rest.reporterName ?? "someone"}`, ...rest,
  }, ctx.gatewayFor);
  if (!result.ok) throw new Error(`Sample job was not created: ${result.message}`);
  return result.job;
}

async function offerFor(ctx: Ctx, jobId: string, tradieId: string): Promise<string> {
  const rows = await ctx.db.query<{ id: string }>(
    "select id from public.offers where job_id = $1::uuid and tradie_id = $2::uuid and status in ('pending', 'expired') order by sent_at desc limit 1",
    [jobId, tradieId],
  );
  if (!rows[0]) throw new Error("Sample data: that tradie was not offered the job.");
  return rows[0].id;
}

async function accept(ctx: Ctx, jobId: string, tradieId: string): Promise<void> {
  const offerId = await offerFor(ctx, jobId, tradieId);
  const result = await ctx.db.tx((tx) => acceptOffer(tx, offerId, "link"));
  if (result.result !== "accepted") throw new Error(`Sample data: accepting gave "${result.result}".`);
}

/** "I have arrived", with a before photo taken at the door and the phone's location (DECISIONS.md, 2026-11-19). */
async function arrive(ctx: Ctx, jobId: string, tradieId: string, where: { lat: number; lng: number }): Promise<void> {
  const before = await picture(ctx, `tradie:${tradieId}`, "before", "before");
  const result = await markArrived(ctx.db, jobId, tradieId, { ...where, uploadIds: [before] });
  if (!result.ok) throw new Error(`Sample data: arriving gave "${result.message}".`);
}

/** "Job done", with after photos and, unless `where` is null (the phone gave no location), where the phone was. */
async function finish(ctx: Ctx, jobId: string, tradieId: string, note: string, where: { lat: number; lng: number } | null, photos = 2): Promise<void> {
  const uploadIds: string[] = [];
  for (let index = 0; index < photos; index += 1) uploadIds.push(await picture(ctx, `tradie:${tradieId}`, "completion", "after"));
  const result = await completeJob(ctx.db, jobId, tradieId, { note, uploadIds, ...(where ?? {}) });
  if (!result.ok) throw new Error(`Sample data: finishing gave "${result.message}".`);
  await chargeJob(ctx.db, ctx.gatewayFor, jobId);
}

/** Where the sample houses are (made up, but in the right streets), and a phone a few metres away at the door. */
const PINS = {
  lakeview: { lat: -45.0336, lng: 168.6551 },
  cabin: { lat: -44.9895, lng: 168.6762 },
  studio: { lat: -45.0383, lng: 168.6321 },
  house: { lat: -45.0474, lng: 168.6957 },
};
const door = (pin: { lat: number; lng: number }) => ({ lat: pin.lat + 0.0001, lng: pin.lng + 0.0001 });

/** Returns the people the demo menu offers to sign in as. */
export async function buildSampleData(db: Db, files: FileStore | null, real: Date): Promise<DemoPerson[]> {
  const gatewayFor: GatewayFor = (country) => createDemoGateway(db, country);
  setTestNow(new Date(real.getTime() - 30 * DAY));

  await updateMarket(db, MARKET, { stage: "live", taxRegistered: true, taxNumber: "123-456-789" }, "admin");
  const tiers = new Map((await listTiers(db, MARKET)).map((tier) => [tier.key, { id: tier.id, priceCents: tier.monthlyPriceCents }]));
  const menu = new Map((await listMenu(db, MARKET)).map((item) => [item.code, item.id]));
  const ctx: Ctx = { db, gatewayFor, files, real, menu, tiers };

  // ---- the team -----------------------------------------------------------
  const mariaId = await addStaff(db, { name: "Maria Santos", email: "maria@example.com", role: "dispatcher", signInUrl: "/sign-in" }, "admin");
  const adminId = await addStaff(db, { name: "Alex Admin", email: "admin@example.com", role: "admin", signInUrl: "/sign-in" }, "admin");

  // ---- tradies ------------------------------------------------------------
  const dave = await tradie(ctx, {
    name: "Dave Wilson", business: "Dave's Plumbing & Gas", phone: "+64211234501", email: "dave@example.com", trades: ["plumber", "gasfitter"], afterHours: true,
    licences: { plumber: "2028-03-31", gasfitter: "2028-03-31" },
  });
  const mere = await tradie(ctx, {
    name: "Mere Tane", business: "Lakes Plumbing", phone: "+64211234502", email: "mere@example.com", trades: ["plumber"], afterHours: false,
    licences: { plumber: new Date(real.getTime() + 20 * DAY).toISOString().slice(0, 10) },
  });
  const tom = await tradie(ctx, {
    name: "Tom Chen", business: "Remarkable Electrical", phone: "+64211234503", email: "tom@example.com", trades: ["electrician", "heat_pump_tech", "appliance_tech"], afterHours: true,
    licences: { electrician: "2027-09-30", heat_pump_tech: "2027-09-30", appliance_tech: "2027-09-30" },
  });
  const andy = await tradie(ctx, { name: "Andy Brown", business: "Handy Andy", phone: "+64211234504", email: "andy@example.com", trades: ["handyman", "locksmith"], afterHours: false });
  const lena = await tradie(ctx, { name: "Lena Kowalski", business: "Southern Fix-It", phone: "+64211234505", email: "lena@example.com", trades: ["handyman"], afterHours: true });
  await tradie(ctx, {
    name: "Kiri Rangi", business: "Kiri Electrical", phone: "+64211234506", email: "kiri@example.com", trades: ["electrician"], afterHours: false, approve: false,
    licences: { electrician: "2027-12-31" }, notes: "Applied through the tradie page. Licence still to be checked on the register.",
  });

  for (const [trade, first, backup] of [
    ["plumber", dave.tradieId, mere.tradieId], ["gasfitter", dave.tradieId, null], ["electrician", tom.tradieId, null], ["heat_pump_tech", tom.tradieId, null],
    ["appliance_tech", tom.tradieId, null], ["handyman", andy.tradieId, lena.tradieId],
  ] as const) {
    await setSlot(db, { market: MARKET, trade, rank: 1, tradieId: first }, "admin");
    if (backup) await setSlot(db, { market: MARKET, trade, rank: 2, tradieId: backup }, "admin");
  }

  // ---- owners and properties ----------------------------------------------
  const cleaner = await registerReferrer(db, { name: "Mele Fifita", phone: "+64211234521", email: "mele@example.com" });
  const sam = await owner(ctx, { name: "Sam Taylor", email: "sam@example.com", phone: "+64211234511", home: "Auckland", card: "ok" });
  // Her card is fine when her job goes out, and declines later (job 4).
  const priya = await owner(ctx, { name: "Priya Patel", email: "priya@example.com", phone: "+64211234512", home: "Sydney", card: "ok" });
  const tane = await owner(ctx, { name: "Tane Rangi", email: "tane@example.com", phone: "+64211234513", home: "Queenstown", card: "ok" });

  const lakeview = await property(ctx, sam.ownerId, {
    name: "Lakeview Apartment", address: "14B Lake Esplanade", suburb: "Queenstown", postcode: "9300",
    access: "Lockbox on the left of the front door, code 4821. Park in space 14B. Water shut-off is under the kitchen sink. Switchboard is in the hall cupboard.",
    pin: PINS.lakeview,
  });
  const cabin = await property(ctx, sam.ownerId, {
    name: "Arthurs Point Cabin", address: "27 Atley Road", suburb: "Arthurs Point", postcode: "9371",
    access: "Key safe by the back door, code 0915. Steep drive: park at the top in winter.", pin: PINS.cabin,
  });
  const studio = await property(ctx, priya.ownerId, {
    name: "Fernhill Studio", address: "3/88 Fernhill Road", suburb: "Fernhill", postcode: "9300", access: "Smart lock. Ring the owner for a one-day code.", pin: PINS.studio,
  });
  const house = await property(ctx, tane.ownerId, {
    name: "Kelvin Heights House", address: "5 Peninsula Road", suburb: "Kelvin Heights", postcode: "9300",
    access: "Lockbox on the gate post, code 7730. Gas bottles are down the right-hand side of the house.", referralCode: cleaner.code, pin: PINS.house,
  });

  // Sam's cleaner is on his team (DECISIONS.md, 2026-11-18): one link for both of his houses, signed with her name.
  setTestNow(new Date(real.getTime() - 19 * DAY));
  const meleOnTeam = await addTeamMember(db, sam.ownerId, "+64211234521", { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id, cabin.id], groupIds: [] });
  const meleUserId = (await db.query<{ user_id: string }>("select user_id from public.team_links where id = $1::uuid", [meleOnTeam.member.linkId]))[0]!.user_id;

  // A property manager on Portfolio (DECISIONS.md, 2026-11-17): ten properties, the pilot size, on the
  // 10-24 band. She picked Portfolio with her first property, every later one joined it, and one
  // retainer covers them all. Started through the same steps as the Billing page's button.
  const hana = await owner(ctx, { name: "Hana Moore", email: "hana@example.com", phone: "+64211234514", home: "Queenstown", card: "ok" });
  const portfolioTier = ctx.tiers.get("portfolio")!;
  setTestNow(new Date(real.getTime() - 21 * DAY));
  const managed = [
    ["Frankton Townhouse 1", "2 Hawthorne Drive", "Frankton"], ["Frankton Townhouse 2", "4 Hawthorne Drive", "Frankton"],
    ["Fernhill Loft", "12 Richards Park Lane", "Fernhill"], ["Goldfields Cottage", "9 Goldfield Heights", "Queenstown"],
    ["Jacks Point Villa", "31 Maori Jack Road", "Jacks Point"], ["Lake Hayes Retreat", "7 Lower Shotover Road", "Lake Hayes"],
    ["Sunshine Bay Studio", "18 Fernhill Road", "Sunshine Bay"], ["Remarkables Park Apartment", "5 Hawthorne Drive", "Frankton"],
    ["Arthurs Point Chalet", "60 Arthurs Point Road", "Arthurs Point"], ["Queenstown Hill Suite", "22 Belfast Terrace", "Queenstown"],
  ] as const;
  for (const [name, address, suburb] of managed) {
    await createProperty(db, hana.ownerId, {
      market: MARKET, name, addressLine1: address, suburb, postcode: "9300", tierId: portfolioTier.id,
      accessNotes: "Key safe by the front door. Code is in the manager's notes: ring the office on arrival.",
    });
  }
  setTestNow(new Date(real.getTime() - 20 * DAY));
  const hanaPortfolio = await openPortfolio(db, hana.ownerId, MARKET);
  const retainer = await startPortfolio(db, gatewayFor("NZ")!, { ownerId: hana.ownerId, portfolioId: hanaPortfolio!.id, successUrl: "/app/billing", cancelUrl: "/app/billing" });
  if (retainer.kind !== "active") throw new Error(`Sample data: the Portfolio did not start (${retainer.kind === "error" ? retainer.message : "card page"}).`);

  // The codes below are jobs on seed/menu-queenstown.json: PL-08 blocked drain, HP-03 heat pump fault, HM-14 reseal a
  // shower, EL-01 power point, PL-06 no hot water, LS-02 lock replace, HM-03 light bulbs, PL-03 dripping tap.

  // ---- 1. Done and paid, six days ago (reported by the cleaner) ------------
  ago(ctx, 6 * DAY);
  const one = await log(ctx, lakeview, {
    code: "PL-08", reportedBy: "team", reporterName: "Mele", reporterPhone: "+64211234521", description: "Kitchen sink is draining very slowly and smells. Tried boiling water, no change.", photos: 1,
    teamMemberId: meleOnTeam.member.id, actor: `team:${meleOnTeam.member.id}`,
  });
  ago(ctx, 6 * DAY - 4 * MINUTE);
  await accept(ctx, one.id, dave.tradieId);
  ago(ctx, 6 * DAY - 2 * HOUR);
  await markEnRoute(db, one.id, dave.tradieId);
  ago(ctx, 6 * DAY - 2.5 * HOUR);
  await arrive(ctx, one.id, dave.tradieId, door(PINS.lakeview));
  // A part at Dave's own price, including GST (DECISIONS.md, 2026-11-23): NZ$52 to the owner, Dave gets it less 3% (NZ$50.44).
  ago(ctx, 6 * DAY - 2.75 * HOUR);
  const trap = await addParts(db, one.id, dave.tradieId, { parts: [{ name: "Kitchen waste trap, 40 mm", quantity: 1, unitCents: 5200 }] });
  if (!trap.ok) throw new Error(`Sample data: adding parts gave "${trap.message}".`);
  ago(ctx, 6 * DAY - 3.25 * HOUR);
  await finish(ctx, one.id, dave.tradieId, "Cleared a fat blockage in the kitchen waste and flushed the trap. Ran hot water for five minutes: draining well.", door(PINS.lakeview));
  // A spot check (DECISIONS.md, 2026-11-23): Maria asks for the trap's receipt, Dave sends it, and his payment goes on.
  ago(ctx, 6 * DAY - 4 * HOUR);
  const trapPart = trap.parts[0]!;
  await requestReceipt(db, trapPart.id, `staff:${mariaId}`);
  ago(ctx, 6 * DAY - 5 * HOUR);
  const trapReceipt = await picture(ctx, `tradie:${dave.tradieId}`, "receipt", "found");
  const sent = await attachReceipt(db, one.id, dave.tradieId, trapPart.id, { uploadId: trapReceipt, receiptDate: null });
  if (!sent.ok) throw new Error(`Sample data: the receipt gave "${sent.message}".`);
  ago(ctx, 6 * DAY - 28 * HOUR);
  await releaseDuePayouts(db, gatewayFor);

  // ---- 2. The tradie was not there by the promised time (a no-show), the
  // dispatcher rang him, then it was done. Nothing is credited: the owner pays
  // the menu price for the job that was done (DECISIONS.md, 2026-11-18).
  ago(ctx, 3 * DAY);
  const two = await log(ctx, cabin, { code: "HP-03", description: "Heat pump in the lounge runs but only blows cold. Guests arrive Friday." });
  ago(ctx, 3 * DAY - 9 * MINUTE);
  await accept(ctx, two.id, tom.tradieId);
  ago(ctx, 3 * DAY - 24 * HOUR - 5 * MINUTE);
  await markMissedWindows(db);
  const missed = await db.query<{ id: string }>("select id from public.exceptions where job_id = $1::uuid and kind in ('missed_window', 'no_show')", [two.id]);
  ago(ctx, 3 * DAY - 24.5 * HOUR);
  if (missed[0]) await resolveException(db, missed[0].id, `staff:${mariaId}`, "Rang Tom: held up on an emergency and on his way. Rang Sam to say sorry.");
  ago(ctx, 3 * DAY - 26 * HOUR);
  await arrive(ctx, two.id, tom.tradieId, door(PINS.cabin));
  ago(ctx, 3 * DAY - 27 * HOUR);
  // Tom's phone gave no location when he tapped Job done, so the job is flagged: his payment waits for Sam to
  // confirm on the job page (DECISIONS.md, 2026-11-19). Sam has not answered yet.
  await finish(ctx, two.id, tom.tradieId, "Filters were blocked solid. Cleaned both, checked the outdoor unit, tested on heat for 20 minutes: 38 degrees at the vent.", null);
  ago(ctx, 3 * DAY - 52 * HOUR);
  await releaseDuePayouts(db, gatewayFor);

  // ---- 3. Done, then the owner said something was wrong --------------------
  ago(ctx, 2 * DAY);
  const three = await log(ctx, lakeview, { code: "HM-14", description: "Black mould along the bottom of the shower screen. Please re-seal." });
  ago(ctx, 2 * DAY - 6 * MINUTE);
  await accept(ctx, three.id, andy.tradieId);
  ago(ctx, 2 * DAY - 2 * HOUR);
  await arrive(ctx, three.id, andy.tradieId, door(PINS.lakeview));
  ago(ctx, 2 * DAY - 3 * HOUR);
  await finish(ctx, three.id, andy.tradieId, "Cut out the old silicone, cleaned and dried, re-sealed the tray and screen. Leave it 24 hours before using the shower.", door(PINS.lakeview));
  ago(ctx, 2 * DAY - 22 * HOUR);
  await raiseDispute(db, three.id, `owner:${sam.ownerId}`, "The new silicone is already lifting at the left corner and the cleaner says water is getting behind it.");

  // ---- 4. Done: the hold paid the job, but the card declined the part beyond it -------------------------
  // (DECISIONS.md, 2026-11-23.) Priya's card was fine when the job went out, so the NZ$225 price was held on it. It was
  // declined later, so the part, charged beyond the hold, failed: she owes that, and Tom is paid at the usual time anyway.
  ago(ctx, 27 * HOUR);
  const four = await log(ctx, studio, { code: "EL-01", description: "Power point by the bed has stopped working. Others in the room are fine." });
  ago(ctx, 27 * HOUR - 3 * MINUTE);
  await accept(ctx, four.id, tom.tradieId);
  await saveBilling(db, { ownerId: priya.ownerId, country: "NZ", provider: "demo", customerId: `demo_cus_${priya.ownerId.replace(/-/g, "").slice(0, 16)}`, card: DEMO_CARD_DECLINES });
  ago(ctx, 25 * HOUR);
  await arrive(ctx, four.id, tom.tradieId, door(PINS.studio));
  // The new power point, picked from the price list (NZ$15.13) and priced by Tom at NZ$22, inside the no-ask limit.
  ago(ctx, 24.75 * HOUR);
  const powerPoint = (await listPriceList(db, MARKET)).find((item) => item.code === "PEL-01");
  const parts = await addParts(db, four.id, tom.tradieId, { parts: [{ name: powerPoint?.name ?? "Double power point", quantity: 1, unitCents: 2200, priceListItemId: powerPoint?.id ?? null }] });
  if (!parts.ok) throw new Error(`Sample data: adding parts gave "${parts.message}".`);
  ago(ctx, 24.25 * HOUR);
  await finish(ctx, four.id, tom.tradieId, "Replaced the power point. The old one had a burnt terminal. Tested and safe.", door(PINS.studio), 1);

  // ---- 5. Off-menu: the tradie has quoted 5.75 hours (NZ$920, less the NZ$225 call-out: NZ$695 more), over the NZ$600 limit, and is waiting for the owner -----
  ago(ctx, 3 * HOUR);
  const five = await log(ctx, cabin, {
    menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Water stain spreading on the lounge ceiling", description: "Brown stain about the size of a dinner plate, under the bathroom. It was not there last week.", photos: 2,
  });
  ago(ctx, 3 * HOUR - 5 * MINUTE);
  const daveOffer = await offerFor(ctx, five.id, dave.tradieId);
  await db.tx((tx) => passOffer(tx, daveOffer, "link"));
  ago(ctx, 3 * HOUR - 9 * MINUTE);
  await accept(ctx, five.id, mere.tradieId);
  ago(ctx, 75 * MINUTE);
  await arrive(ctx, five.id, mere.tradieId, door(PINS.cabin));
  ago(ctx, 40 * MINUTE);
  const found = await picture(ctx, `tradie:${mere.tradieId}`, "quote", "found");
  await submitQuote(db, five.id, mere.tradieId, { description: "Replace the leaking shower mixer and the section of pipe behind it", hours: 5.75, uploadIds: [found] });

  // ---- 6. Urgent: accepted, the tradie is on the way -----------------------
  ago(ctx, 50 * MINUTE);
  const six = await log(ctx, house, { code: "PL-06", urgent: true, description: "No hot water. Guests are in the house tonight." });
  ago(ctx, 47 * MINUTE);
  await accept(ctx, six.id, dave.tradieId);
  ago(ctx, 12 * MINUTE);
  await markEnRoute(db, six.id, dave.tradieId);

  // ---- 7. Nobody accepted: it is in the dispatcher's queue -----------------
  ago(ctx, 45 * MINUTE);
  await log(ctx, lakeview, { code: "LS-02", description: "The key safe is jammed and will not take the code. Cleaner is using the spare key for now." });
  ago(ctx, 28 * MINUTE);
  await expireDueOffers(db);

  // ---- 8. A guest scanned the QR code: waiting for the owner's go-ahead ----
  ago(ctx, 25 * MINUTE);
  await log(ctx, lakeview, { code: "HM-03", reportedBy: "guest", reporterName: "Emma", reporterPhone: "+64211234531", description: "Two of the lights over the kitchen bench are out.", photos: 1 });

  // ---- 9. Just logged: on offer to the first-choice plumber right now ------
  ago(ctx, 3 * MINUTE);
  await log(ctx, lakeview, { code: "PL-03", description: "Bathroom basin tap drips all night. Guests have mentioned it twice." });

  // ---- a few people from the public pages ----------------------------------
  const lead = (ms: number, values: unknown[]) =>
    db.query(
      `insert into public.leads (created_at, lead_type, market, name, phone, email, property_count, managed_by, owner_location, trade, licence_number, days_available, source, landing_path)
       values ($1::timestamptz, $2, 'queenstown', $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13)`,
      [new Date(real.getTime() - ms).toISOString(), ...values],
    );
  await lead(2 * DAY, ["owner", "Hannah Lee", "+64211234541", "hannah@example.com", 2, "self", "Christchurch", null, null, null, "facebook", "/in/queenstown"]);
  await lead(26 * HOUR, ["owner", "Marco Rossi", "+61412345678", "marco@example.com", 1, "manager", "Melbourne", null, null, null, "google", "/owners"]);
  await lead(5 * HOUR, ["tradie", "Jo Sparks", "+64211234542", "jo@example.com", null, null, null, "electrician", "E123456", ["mon", "tue", "wed", "thu", "fri"], "direct", "/tradies"]);

  // Back to the present. Hand every text to the demo phone (they go out a batch at a time).
  setTestNow(real);
  for (let round = 0; round < 20; round += 1) {
    const batch = await flushOutbox(db);
    if (batch.sent + batch.failed + batch.demo === 0) break;
  }
  setTestNow(null);

  return [
    { key: "sam", label: "Sam Taylor", role: "owner", userId: sam.user.id, phone: sam.user.phone, note: "Owns Lakeview Apartment and Arthurs Point Cabin. Has a quote and a guest report waiting for an answer." },
    { key: "priya", label: "Priya Patel", role: "owner", userId: priya.user.id, phone: priya.user.phone, note: "Owns Fernhill Studio. Her card is declining: the hold paid her job, the part beyond it failed." },
    { key: "hana", label: "Hana Moore (manager)", role: "owner", userId: hana.user.id, phone: hana.user.phone, note: "Manages ten properties on Portfolio: one NZ$600 retainer a month for all of them." },
    { key: "tane", label: "Tane Rangi", role: "owner", userId: tane.user.id, phone: tane.user.phone, note: "Owns Kelvin Heights House. A plumber is on the way to an urgent job." },
    { key: "dave", label: "Dave (plumber and gasfitter)", role: "tradie", userId: dave.user.id, phone: dave.phone, note: "Has a job offer waiting right now, and is on the way to an urgent one." },
    { key: "mere", label: "Mere (plumber)", role: "tradie", userId: mere.user.id, phone: mere.phone, note: "On site, waiting for the owner to answer her quote." },
    { key: "tom", label: "Tom (electrician)", role: "tradie", userId: tom.user.id, phone: tom.phone, note: "Two finished jobs. One is waiting on the owner's card." },
    { key: "andy", label: "Andy (handyman and locks)", role: "tradie", userId: andy.user.id, phone: andy.phone, note: "Let an offer run out. Has a payment on hold." },
    { key: "lena", label: "Lena (handyman)", role: "tradie", userId: lena.user.id, phone: lena.phone, note: "Backup handyman. No jobs yet." },
    { key: "maria", label: "Maria (dispatcher)", role: "dispatcher", userId: mariaId, phone: null, note: "The virtual assistant. Works the queue." },
    { key: "admin", label: "Admin (you)", role: "admin", userId: adminId, phone: null, note: "Sees everything: numbers, prices, markets, staff." },
    { key: "mele", label: "Mele (cleaner)", role: "cleaner", userId: meleUserId, phone: "+64211234521", note: "On Sam's team: one link for Lakeview Apartment and Arthurs Point Cabin. Referred an owner." },
    { key: "emma", label: "Emma (guest)", role: "guest", userId: null, phone: "+64211234531", note: "Scanned the QR card at Lakeview Apartment." },
  ];
}
