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
    // Queenstown's starting values (config/markets.ts and DECISIONS.md): $99 a month, $99 founding deposit,
    // urgent $90, after hours $140, $225 to come and look at something off the menu, quotes over $600 need a yes.
    expect(contentTokens(launchMarket)).toEqual({
      brand: "HostFix",
      market: "Queenstown",
      country: "New Zealand",
      deposit: "NZ$99",
      essential: "NZ$99",
      // Portfolio's lowest band, 10-24 properties: NZ$600 a month (DECISIONS.md, 2026-11-17).
      portfolio_from: "NZ$600",
      urgent: "NZ$90",
      after_hours: "NZ$140",
      callout: "NZ$225",
      approval_limit: "NZ$600",
      payout_days: "5 to 6 working days",
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
    expect(contentTokens(noosa)).toMatchObject({ market: "Noosa", deposit: "A$59", essential: "A$109", urgent: "A$95", approval_limit: "A$750" });
    // Australian card money clears faster than New Zealand's, so the page says so.
    expect(contentTokens({ ...noosa, country: "AU" as const }).payout_days).toBe("3 to 4 working days");
  });

  it("still fill in the prices after a membership has been replaced by one with a new short code", () => {
    const [essential] = launchMarket.tiers;
    // The admin put the price up: a new membership at the new price, the old one closed to new members (so not in the list).
    const repriced = { ...launchMarket, tiers: [{ ...essential!, key: "essential_2027", monthlyPriceCents: 11900 }] };
    expect(contentTokens(repriced)).toMatchObject({ essential: "NZ$119" });
    // Short codes that match nothing: the cheapest one on offer stands in.
    const renamed = { ...launchMarket, tiers: [{ ...essential!, key: "gold", monthlyPriceCents: 14900 }, { ...essential!, key: "basic" }] };
    expect(contentTokens(renamed)).toMatchObject({ essential: "NZ$99" });
    // The one called "essential" wins over a cheaper one with another name.
    const both = { ...launchMarket, tiers: [{ ...essential!, key: "trial", monthlyPriceCents: 4900 }, essential!] };
    expect(contentTokens(both)).toMatchObject({ essential: "NZ$99" });
    // None at all cannot show a price, and says what to do.
    expect(() => contentTokens({ ...launchMarket, tiers: [] })).toThrow('The market "Queenstown" has no membership on offer');
  });

  it("are filled in wherever they appear, with or without spaces", () => {
    expect(fillTokens("{{brand}} in {{ market }} from {{essential}}", contentTokens(launchMarket), "x.md")).toBe(
      "HostFix in Queenstown from NZ$99",
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

  it("the owner page shows the Essential card and the Portfolio card for managers, with the note about job charges below both", () => {
    const pricing = loadLanding("owner", launchMarket).sections.find((s) => s.id === "what-it-costs");
    expect(pricing?.blocks.map((b) => b.type)).toEqual(["card", "card", "paragraph"]);
    const managers = JSON.stringify(pricing?.blocks[1]);
    // From the lowest band (10-24 properties, NZ$600), and the pilot on 10 properties: nothing more is promised.
    expect(managers).toContain("Managing 10 or more?");
    expect(managers).toContain("one monthly retainer from NZ$600");
    expect(managers).toContain("Pilot on 10 properties first.");
  });

  it("a market with no Portfolio on offer shows an [EDIT] marker where its price would be, rather than breaking the page", () => {
    const essentialOnly = { ...launchMarket, tiers: launchMarket.tiers.filter((tier) => tier.billingBasis === "per_property") };
    expect(contentTokens(essentialOnly).portfolio_from).toMatch(/^\[EDIT/);
    expect(contentTokens(essentialOnly).essential).toBe("NZ$99");
  });

  it("the owner page states the real prices from the market settings, and no second membership", () => {
    const text = JSON.stringify(loadLanding("owner", launchMarket));
    for (const price of ["NZ$99", "NZ$90", "NZ$140", "NZ$225", "NZ$600"]) expect(text).toContain(price);
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
});
