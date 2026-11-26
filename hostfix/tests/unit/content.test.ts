import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import {
  ContentError,
  contentTokens,
  countEditMarkers,
  fillTokens,
  loadLanding,
  parseLanding,
  plainText,
  type Block,
} from "@/lib/content";

const sample = `# Fixed *fast* in Queenstown

Intro paragraph with **bold** and a [link](/tradies).

- Point one
- **Lead.** Point two

## How it works

1. Step one
2. Step two

> A promise worth a box.

## What it costs

### Essential: NZ$99

One paragraph.

### Priority: NZ$149

- Included thing

Loose text after cards [EDIT: finish this].
`;

describe("parseLanding", () => {
  const content = parseLanding(sample, "sample.md");

  it("takes the first heading as the headline", () => {
    expect(content.headlineText).toBe("Fixed fast in Queenstown");
    expect(content.headline).toEqual([
      { type: "text", text: "Fixed " },
      { type: "em", children: [{ type: "text", text: "fast" }] },
      { type: "text", text: " in Queenstown" },
    ]);
  });

  it("keeps what sits under the headline as the introduction", () => {
    expect(content.intro.map((b) => b.type)).toEqual(["paragraph", "list"]);
    expect(content.summaryText).toBe("Intro paragraph with bold and a link.");
    const list = content.intro[1] as Extract<Block, { type: "list" }>;
    expect(list.ordered).toBe(false);
    expect(list.items.map(plainText)).toEqual(["Point one", "Lead. Point two"]);
    expect(list.items[1]?.[0]).toEqual({ type: "strong", children: [{ type: "text", text: "Lead." }] });
  });

  it("splits the rest into sections with link-friendly ids", () => {
    expect(content.sections.map((s) => s.id)).toEqual(["how-it-works", "what-it-costs"]);
    expect(content.sections.map((s) => plainText(s.title))).toEqual(["How it works", "What it costs"]);
  });

  it("recognises numbered steps and highlighted boxes", () => {
    const [steps, quote] = content.sections[0]!.blocks;
    expect(steps).toMatchObject({ type: "list", ordered: true });
    expect(quote).toEqual({ type: "quote", paragraphs: [[{ type: "text", text: "A promise worth a box." }]] });
  });

  it("turns small headings into cards that hold what follows them", () => {
    const blocks = content.sections[1]!.blocks;
    expect(blocks.map((b) => b.type)).toEqual(["card", "card"]);
    const [essential, priority] = blocks as Extract<Block, { type: "card" }>[];
    expect(plainText(essential!.title)).toBe("Essential: NZ$99");
    expect(essential!.blocks.map((b) => b.type)).toEqual(["paragraph"]);
    expect(priority!.blocks.map((b) => b.type)).toEqual(["list", "paragraph"]);
  });

  it("marks unfinished copy so it can be highlighted and counted", () => {
    expect(content.editMarkers).toBe(1);
    const priority = content.sections[1]!.blocks[1] as Extract<Block, { type: "card" }>;
    const last = priority.blocks[1] as Extract<Block, { type: "paragraph" }>;
    expect(last.children).toEqual([
      { type: "text", text: "Loose text after cards " },
      { type: "edit", text: "[EDIT: finish this]" },
      { type: "text", text: "." },
    ]);
  });

  it("ends a card at a line of three dashes, so a note can sit below the cards", () => {
    const parsed = parseLanding("# H\n\n## Prices\n\n### Basic\n\nIn the card.\n\n---\n\nBelow the cards.\n", "x.md");
    const blocks = parsed.sections[0]!.blocks;
    expect(blocks.map((b) => b.type)).toEqual(["card", "paragraph"]);
    expect((blocks[0] as Extract<Block, { type: "card" }>).blocks).toHaveLength(1);
  });

  it("gives two sections with the same title different ids", () => {
    const twice = parseLanding("# H\n\n## Questions\n\nA\n\n## Questions\n\nB\n", "x.md");
    expect(twice.sections.map((s) => s.id)).toEqual(["questions", "questions-2"]);
  });

  it("never lets a section id clash with the sign-up form's own id", () => {
    expect(parseLanding("# H\n\n## Signup\n\nA\n", "x.md").sections[0]?.id).toBe("signup-2");
  });
});

describe("safety of the copy", () => {
  it("shows raw HTML as plain text instead of running it", () => {
    const content = parseLanding('# H\n\nHello <script>alert(1)</script> there\n\n<div onclick="x()">block</div>\n', "x.md");
    const text = JSON.stringify(content);
    expect(text).not.toContain('"type":"html"');
    expect(plainText((content.intro[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("Hello <script>alert(1)</script> there");
  });

  it("drops links that could run code", () => {
    const content = parseLanding("# H\n\n[click](javascript:alert(1)) and [ok](https://example.com) and [mail](mailto:a@b.co)\n", "x.md");
    const paragraph = content.intro[0] as Extract<Block, { type: "paragraph" }>;
    const links = paragraph.children.filter((n) => n.type === "link");
    expect(links.map((l) => (l.type === "link" ? l.href : ""))).toEqual(["https://example.com", "mailto:a@b.co"]);
    expect(plainText(paragraph.children)).toBe("click and ok and mail");
  });
});

describe("mistakes in the copy are caught with a clear message", () => {
  it("needs a headline", () => {
    expect(() => parseLanding("Just a paragraph.\n", "content/landing-owner.md")).toThrow(
      'content/landing-owner.md must start with a headline: a line beginning with "# ".',
    );
    expect(() => parseLanding("", "x.md")).toThrow(ContentError);
    expect(() => parseLanding("## Section first\n\nText\n", "x.md")).toThrow(/must start with a headline/);
  });

  it("allows only one headline, at the top", () => {
    expect(() => parseLanding("# One\n\n# Two\n", "x.md")).toThrow(/more than one/);
    expect(() => parseLanding("# One\n\n## S\n\n# Two\n", "x.md")).toThrow(/more than one|must come before/);
  });

  it("names a placeholder that does not exist and lists the ones that do", () => {
    expect(() => fillTokens("Hello {{markt}}", { market: "Queenstown", brand: "HostFix" }, "content/landing-owner.md")).toThrow(
      "content/landing-owner.md uses the placeholder {{markt}}, which does not exist. You can use: {{market}}, {{brand}}.",
    );
  });
});

describe("placeholders", () => {
  it("come from the market and brand settings, so nothing is tied to one town or currency", () => {
    // Queenstown's starting values (config/markets.ts and DECISIONS.md): Essential free to join ($0 a month, 2026-11-17),
    // the old $99 founding deposit (no longer offered, kept for the record), urgent $50 (2026-11-18), after hours $140,
    // $225 to come and look at something off the menu, quotes over $600 need a yes. The tradie's share of each surcharge
    // is the surcharge less 15%: 50 - 7.50 = 42.50, and 140 - 21 = 119.
    expect(contentTokens(launchMarket)).toEqual({
      brand: "HostFix",
      market: "Queenstown",
      country: "New Zealand",
      deposit: "NZ$99",
      essential: "NZ$0",
      // Portfolio's lowest band, 10-24 properties: NZ$600 a month (DECISIONS.md, 2026-11-17).
      portfolio_from: "NZ$600",
      urgent: "NZ$50",
      after_hours: "NZ$140",
      urgent_share: "NZ$42.50",
      after_hours_share: "NZ$119",
      emergency: "NZ$150",
      emergency_share: "NZ$127.50",
      platform_fee: "15%",
      callout: "NZ$225",
      approval_limit: "NZ$600",
      // NZ$20 from 23 Nov 2026 (DECISIONS.md, 2026-11-23; was NZ$30).
      parts_included: "NZ$20",
      parts_limit: "NZ$150",
      payout_days: "5 to 6 working days",
      // DECISIONS.md, 2026-11-23: 500 basis points is 5%; the payout guarantee is 100000 cents, NZ$1,000.
      own_client_fee: "5%",
      payout_guarantee: "NZ$1,000",
      tier_threshold: "NZ$1,000",
      above_tier_fee: "3%",
    });
    const noosa = {
      ...launchMarket,
      name: "Noosa",
      countryName: "Australia",
      currency: "AUD" as const,
      tiers: launchMarket.tiers.map((tier) => ({ ...tier, monthlyPriceCents: 10900 })),
      urgentSurchargeCents: 9500,
      approvalThresholdCents: 75000,
      foundingDeposit: { enabled: true, amountCents: 5900, spots: 25, terms: [] },
    };
    // Noosa's urgent A$95 less 15% (14.25) is A$80.75 to the tradie.
    expect(contentTokens(noosa)).toMatchObject({ market: "Noosa", deposit: "A$59", essential: "A$109", urgent: "A$95", urgent_share: "A$80.75", approval_limit: "A$750" });
    // Australian card money clears faster than New Zealand's, so the page says so.
    expect(contentTokens({ ...noosa, country: "AU" as const }).payout_days).toBe("3 to 4 working days");
  });

  it("still fill in the prices after a membership has been replaced by one with a new short code", () => {
    const [essential] = launchMarket.tiers;
    // The admin put the price up: a new membership at the new price, the old one closed to new members (so not in the list).
    const repriced = { ...launchMarket, tiers: [{ ...essential!, key: "essential_2027", monthlyPriceCents: 11900 }] };
    expect(contentTokens(repriced)).toMatchObject({ essential: "NZ$119" });
    // Short codes that match nothing: the cheapest one on offer stands in.
    const renamed = { ...launchMarket, tiers: [{ ...essential!, key: "gold", monthlyPriceCents: 14900 }, { ...essential!, key: "basic", monthlyPriceCents: 9900 }] };
    expect(contentTokens(renamed)).toMatchObject({ essential: "NZ$99" });
    // The one called "essential" wins over another with another name, even when Essential is the free one.
    const both = { ...launchMarket, tiers: [{ ...essential!, key: "trial", monthlyPriceCents: 4900 }, essential!] };
    expect(contentTokens(both)).toMatchObject({ essential: "NZ$0" });
    // None at all cannot show a price, and says what to do.
    expect(() => contentTokens({ ...launchMarket, tiers: [] })).toThrow('The market "Queenstown" has no membership on offer');
  });

  it("are filled in wherever they appear, with or without spaces", () => {
    // Essential is free to join, so its price fills in as NZ$0 rather than breaking the page.
    expect(fillTokens("{{brand}} in {{ market }} from {{essential}}, call-out {{callout}}", contentTokens(launchMarket), "x.md")).toBe(
      "HostFix in Queenstown from NZ$0, call-out NZ$225",
    );
  });

  it("counts [EDIT] markers", () => {
    expect(countEditMarkers("a [EDIT: one] b [EDIT] c [edited] d")).toBe(2);
  });
});

describe("the real landing page files", () => {
  it.each(["owner", "tradie"] as const)("content/landing-%s.md loads and has the expected shape", (kind) => {
    const content = loadLanding(kind, launchMarket);
    expect(content.headlineText.length).toBeGreaterThan(10);
    expect(content.headlineText).toContain("Queenstown");
    expect(content.summaryText.length).toBeGreaterThan(20);
    expect(content.sections.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(content)).not.toContain("{{");
    for (const section of content.sections) expect(section.blocks.length).toBeGreaterThan(0);
  });

  it("the owner page shows one card, free to join and pay per job, with the note about job charges below it", () => {
    // DECISIONS.md, 2026-11-17: free to join. The Portfolio retainer is built but switched off, so it is not sold here.
    const pricing = loadLanding("owner", launchMarket).sections.find((s) => s.id === "what-it-costs");
    expect(pricing?.blocks.map((b) => b.type)).toEqual(["card", "paragraph"]);
    const card = pricing?.blocks[0];
    expect(card?.type === "card" && plainText(card.title)).toBe("Free to join. Pay per job.");
    // Urgent NZ$50 (DECISIONS.md, 2026-11-18) and after hours NZ$140. They no longer go to the tradie in full.
    expect(JSON.stringify(card)).toContain("Need someone within 4 hours? Add NZ$50 on the day and the tradie drops what they are doing. An emergency, within the hour, is NZ$150 more, offered whenever a tradie is working. Either way, add NZ$140 when they come outside working hours.");
    expect(JSON.stringify(card)).not.toContain("in full");
    expect(JSON.stringify(pricing)).not.toContain("Managing 10 or more?");
  });

  it("the owner page says joining is free, and that you only pay for what you got (no missed-promise credit)", () => {
    const content = loadLanding("owner", launchMarket);
    expect(content.intro.flatMap((block) => (block.type === "list" ? block.items.map(plainText) : []))).toEqual([
      "Free to join. Jobs at fixed prices, charged only when something is fixed",
      "A tradie on site within 24 hours, or 4 when it's urgent. Late on an urgent job? You don't pay the urgent fee",
      "Your cleaner and your guests can report a problem from their phone",
    ]);
    // DECISIONS.md, 2026-11-18: missing the time no longer credits the call-out. The owner pays for what actually happened.
    const paid = content.sections.find((section) => plainText(section.title) === "You only pay for what you got");
    expect(JSON.stringify(paid)).toContain("The urgent fee isn't charged.");
    expect(JSON.stringify(paid)).toContain("you pay nothing unless a tradie does the job");
    expect(JSON.stringify(content)).not.toContain("call-out is on us");
    expect(JSON.stringify(content)).not.toContain("comes off your bill automatically");
    const questions = content.sections.find((section) => section.id === "questions")!;
    const asked = questions.blocks.map((block) => (block.type === "card" ? plainText(block.title) : ""));
    expect(asked).toContain("What does it cost to join?");
    expect(JSON.stringify(questions)).toContain("Nothing. You add your property and a card, and you only pay the fixed price when a job is done.");
    const text = JSON.stringify(content).toLowerCase();
    expect(text).not.toContain("founding deposit");
    expect(text).not.toContain("month's membership");
  });

  it("a market with no Portfolio on offer shows an [EDIT] marker where its price would be, rather than breaking the page", () => {
    const essentialOnly = { ...launchMarket, tiers: launchMarket.tiers.filter((tier) => tier.billingBasis === "per_property") };
    expect(contentTokens(essentialOnly).portfolio_from).toMatch(/^\[EDIT/);
    expect(contentTokens(essentialOnly).essential).toBe("NZ$0");
  });

  it("the owner page states the real prices from the market settings, and no second membership", () => {
    const text = JSON.stringify(loadLanding("owner", launchMarket));
    // Urgent NZ$50, after hours NZ$140, the call-out NZ$225 and the quote limit NZ$600. No monthly price: it is free to join.
    for (const price of ["NZ$50", "NZ$140", "NZ$225", "NZ$600"]) expect(text).toContain(price);
    expect(text).not.toContain("NZ$90");
    expect(text).not.toContain("NZ$99");
    expect(text).not.toContain("NZ$0");
    // Priority was removed (DECISIONS.md): its old price and name must not come back.
    expect(text).not.toContain("NZ$149");
    expect(text).not.toMatch(/priority/i);
  });

  it("the owner page does not promise what is not built", () => {
    const text = JSON.stringify(loadLanding("owner", launchMarket)).toLowerCase();
    // Not built yet: one number to ring, calendar or guest-message links, one-off door codes. See DECISIONS.md.
    for (const phrase of ["one number", "calendar", "airbnb messages", "one-off code", "72%"]) expect(text).not.toContain(phrase);
    // And no claim that owners pay more for the fixed price.
    expect(text).not.toMatch(/premium/);
  });

  it("the tradie page promises pay no faster than the payment company can deliver it", () => {
    // Card money takes four working days to clear in New Zealand, so "in your bank within 48 hours" would be a promise we cannot keep.
    const text = JSON.stringify(loadLanding("tradie", launchMarket));
    expect(text).toContain("in your bank about 5 to 6 working days after the job");
    expect(text).not.toMatch(/48 hours/);
  });

  it("the tradie page shows the tradie's share of each surcharge, not the owner's price", () => {
    // DECISIONS.md, 2026-11-18: urgent 5000 less 15% (750) is 4250; after hours 14000 less 15% (2100) is 11900.
    const text = JSON.stringify(loadLanding("tradie", launchMarket));
    expect(text).toContain("Urgent adds NZ$42.50 to your pay when you're on site by the deadline, an emergency (within the hour) adds NZ$127.50 when you're there in time, and after hours adds NZ$119 when you come outside working hours: the surcharge less our 15%, like the rest of the price");
    expect(text).not.toContain("in full");
  });

  it("the tradie page never says passing on a job costs a tradie anything (DECISIONS.md, 2026-11-18)", () => {
    const text = JSON.stringify(loadLanding("tradie", launchMarket));
    expect(text).toContain("Passing on a job never leads to fewer offers or to being removed.");
    expect(text).not.toContain("accept most jobs");
  });
});
