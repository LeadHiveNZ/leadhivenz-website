import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { buildLead, type RawLeadForm } from "@/lib/leads/service";

const market = launchMarket;

function form(fields: Record<string, unknown>, attribution: unknown = ""): RawLeadForm {
  return { fields, attribution, honeypot: "", startedAt: "" };
}

const goodOwner = {
  name: "  Olive Owner ",
  phone: "021 123 4567",
  email: " Olive@Example.COM ",
  propertyCount: "2",
  managedBy: "self",
  ownerLocation: " Auckland ",
};

const goodTradie = {
  name: "Tane Tradie",
  phone: "022 123 4567",
  trade: "plumber",
  licenceNumber: " PGDB 12345 ",
  daysAvailable: ["sat", "mon", "tue"],
};

describe("owner form rules", () => {
  it("accepts a complete form and tidies it up", () => {
    const result = buildLead("owner", form(goodOwner), market);
    expect(result).toMatchObject({
      lead: {
        leadType: "owner",
        market: "queenstown",
        name: "Olive Owner",
        phone: "+64211234567",
        email: "olive@example.com",
        propertyCount: 2,
        managedBy: "self",
        ownerLocation: "Auckland",
        trade: null,
        licenceNumber: null,
        daysAvailable: null,
        source: "direct",
      },
    });
  });

  it("records where the lead came from", () => {
    const result = buildLead(
      "owner",
      form(goodOwner, JSON.stringify({ utm_source: "facebook", utm_campaign: "qt-owners", fbclid: "abc", landing_path: "/owners" })),
      market,
    );
    expect(result).toMatchObject({
      lead: { source: "meta", utmSource: "facebook", utmCampaign: "qt-owners", fbclid: "abc", landingPath: "/owners", gclid: null },
    });
  });

  it("explains each missing field in plain words", () => {
    const result = buildLead("owner", form({}), market);
    expect(result).toEqual({
      fieldErrors: {
        name: "Please enter your name.",
        phone: "Please enter your mobile number.",
        email: "Please enter your email address.",
        propertyCount: "Please enter how many properties you have.",
        managedBy: "Please choose who looks after it now.",
        ownerLocation: "Please tell us where you live.",
      },
    });
  });

  it.each([
    ["name", { name: "A" }, "Please enter your name."],
    ["name", { name: "Visit www.spam.example" }, "Please enter just your name."],
    ["name", { name: "x".repeat(81) }, "That name is too long. Please shorten it."],
    ["phone", { phone: "12345" }, "Please enter your mobile number."],
    ["phone", { phone: "021 000" }, "That phone number doesn't look right. Please check it."],
    ["phone", { phone: "call me maybe" }, "That phone number doesn't look right. Please check it."],
    ["email", { email: "olive@" }, "That email address doesn't look right. Please check it."],
    ["email", { email: "" }, "Please enter your email address."],
    ["propertyCount", { propertyCount: "0" }, "Please enter how many properties you have (at least 1)."],
    ["propertyCount", { propertyCount: "-3" }, "Please enter how many properties you have (at least 1)."],
    ["propertyCount", { propertyCount: "1.5" }, "Please enter a whole number of properties."],
    ["propertyCount", { propertyCount: "lots" }, "Please enter how many properties you have."],
    ["propertyCount", { propertyCount: "5000" }, "That's a lot of properties. Please email us instead."],
    ["managedBy", { managedBy: "aliens" }, "Please choose who looks after it now."],
    ["ownerLocation", { ownerLocation: " " }, "Please tell us where you live."],
  ])("rejects a bad %s", (field, change, message) => {
    const result = buildLead("owner", form({ ...goodOwner, ...change }), market);
    expect(result).toEqual({ fieldErrors: { [field]: message } });
  });

  it("accepts an Australian mobile for an owner who lives in Australia", () => {
    const result = buildLead("owner", form({ ...goodOwner, phone: "0412 345 678", ownerLocation: "Sydney" }), market);
    expect(result).toMatchObject({ lead: { phone: "+61412345678" } });
  });
});

describe("tradie form rules", () => {
  it("accepts a complete form and puts the days in week order", () => {
    const result = buildLead("tradie", form(goodTradie), market);
    expect(result).toMatchObject({
      lead: {
        leadType: "tradie",
        name: "Tane Tradie",
        phone: "+64221234567",
        email: null,
        trade: "plumber",
        licenceNumber: "PGDB 12345",
        daysAvailable: ["mon", "tue", "sat"],
        propertyCount: null,
      },
    });
  });

  it("treats the licence number as optional", () => {
    const blank = buildLead("tradie", form({ ...goodTradie, trade: "handyman", licenceNumber: "" }), market);
    expect(blank).toMatchObject({ lead: { licenceNumber: null } });
    const missing = buildLead("tradie", form({ name: "Tane Tradie", phone: "022 123 4567", trade: "handyman", daysAvailable: ["mon"] }), market);
    expect(missing).toMatchObject({ lead: { licenceNumber: null } });
  });

  it("explains each missing field in plain words", () => {
    const result = buildLead("tradie", form({ daysAvailable: [] }), market);
    expect(result).toEqual({
      fieldErrors: {
        name: "Please enter your name.",
        phone: "Please enter your mobile number.",
        trade: "Please choose your trade.",
        daysAvailable: "Please tick at least one day.",
      },
    });
  });

  it("rejects a trade or a day that is not on the list", () => {
    expect(buildLead("tradie", form({ ...goodTradie, trade: "wizard" }), market)).toEqual({
      fieldErrors: { trade: "Please choose your trade." },
    });
    expect(buildLead("tradie", form({ ...goodTradie, daysAvailable: ["funday"] }), market)).toEqual({
      fieldErrors: { daysAvailable: "Please tick the days you're available." },
    });
  });

  it("ignores repeated days", () => {
    const result = buildLead("tradie", form({ ...goodTradie, daysAvailable: ["mon", "mon", "sun"] }), market);
    expect(result).toMatchObject({ lead: { daysAvailable: ["mon", "sun"] } });
  });
});
