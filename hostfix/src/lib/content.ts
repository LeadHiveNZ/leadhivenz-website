import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Lexer, type Token } from "marked";
import { brand } from "@config/brand";
import type { Market } from "@config/markets";
import { formatMoney } from "@/lib/money";

/**
 * LANDING PAGE COPY
 * The words on the two landing pages live in /content as Markdown files that
 * anyone can edit:
 *
 *   # The headline                      (one, at the top)
 *   A sentence or two under it.
 *   - Short points beside the form
 *
 *   ## A section heading                (as many as you like, in any order)
 *   Paragraphs, bullet lists, numbered steps.
 *   > A line starting with > becomes a highlighted box.
 *   ### A small heading                 (becomes a card: prices, questions)
 *   ---                                 (three dashes end a card, so the next
 *                                        paragraph sits below the cards)
 *
 * These placeholders are filled in from the config files:
 *   {{brand}} {{market}} {{country}} {{deposit}} {{essential}} {{priority}}
 *
 * Anything written as [EDIT: ...] is shown highlighted on the page and counted
 * on the admin screen, so unfinished copy is hard to miss.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "edit"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "break" };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; paragraphs: Inline[][] }
  | { type: "card"; title: Inline[]; blocks: Block[] };

export type Section = { id: string; title: Inline[]; blocks: Block[] };

export type LandingContent = {
  headline: Inline[];
  /** The headline as plain text, for the browser tab. */
  headlineText: string;
  /** The first paragraph as plain text, for search engines. */
  summaryText: string;
  intro: Block[];
  sections: Section[];
  /** How many [EDIT: ...] placeholders are still in the copy. */
  editMarkers: number;
};

export class ContentError extends Error {}

export function contentTokens(market: Market): Record<string, string> {
  const tierPrice = (key: string): string => {
    const tier = market.tiers.find((t) => t.key === key);
    if (!tier) throw new ContentError(`The market "${market.name}" has no "${key}" membership tier in config/markets.ts.`);
    return formatMoney(tier.monthlyPriceCents, market.currency);
  };
  return {
    brand: brand.name,
    market: market.name,
    country: market.countryName,
    deposit: formatMoney(market.foundingDeposit.amountCents, market.currency),
    essential: tierPrice("essential"),
    priority: tierPrice("priority"),
  };
}

export function fillTokens(raw: string, tokens: Record<string, string>, fileLabel: string): string {
  return raw.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, name: string) => {
    const value = tokens[name];
    if (value === undefined) {
      throw new ContentError(
        `${fileLabel} uses the placeholder {{${name}}}, which does not exist. You can use: ${Object.keys(tokens)
          .map((key) => `{{${key}}}`)
          .join(", ")}.`,
      );
    }
    return value;
  });
}

export function countEditMarkers(text: string): number {
  return (text.match(/\[EDIT\b/g) ?? []).length;
}

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/|#)/i;
const EDIT_MARKER = /(\[EDIT\b[^\]]*\])/g;

function textNodes(text: string): Inline[] {
  return text
    .split(EDIT_MARKER)
    .filter((part) => part !== "")
    .map((part) => (part.startsWith("[EDIT") ? { type: "edit", text: part } : { type: "text", text: part }));
}

type AnyToken = Token & { tokens?: Token[]; text?: string; href?: string; raw?: string };

function inlineFrom(tokens: Token[] | undefined): Inline[] {
  const result: Inline[] = [];
  for (const token of (tokens ?? []) as AnyToken[]) {
    switch (token.type) {
      case "strong":
        result.push({ type: "strong", children: inlineFrom(token.tokens) });
        break;
      case "em":
        result.push({ type: "em", children: inlineFrom(token.tokens) });
        break;
      case "link": {
        const href = token.href ?? "";
        const children = inlineFrom(token.tokens);
        if (SAFE_LINK.test(href)) result.push({ type: "link", href, children });
        else result.push(...children);
        break;
      }
      case "br":
        result.push({ type: "break" });
        break;
      case "text":
        // A "text" token can itself hold formatted pieces (for example inside a list item).
        if (token.tokens && token.tokens.length > 0) result.push(...inlineFrom(token.tokens));
        else result.push(...textNodes(token.text ?? ""));
        break;
      case "del":
        result.push(...inlineFrom(token.tokens));
        break;
      case "image":
        // Images are not supported in the copy. Show the description instead.
        result.push(...textNodes(token.text ?? ""));
        break;
      default:
        // escape, codespan, inline html and anything else: show it as plain text.
        result.push(...textNodes(token.text ?? token.raw ?? ""));
    }
  }
  return result;
}

function itemInline(item: AnyToken): Inline[] {
  const parts: Inline[] = [];
  for (const child of (item.tokens ?? []) as AnyToken[]) {
    if (child.type === "text" || child.type === "paragraph") {
      if (parts.length > 0) parts.push({ type: "text", text: " " });
      parts.push(...inlineFrom(child.tokens ?? [child]));
    }
  }
  return parts;
}

function blockFrom(token: AnyToken): Block | null {
  switch (token.type) {
    case "paragraph":
      return { type: "paragraph", children: inlineFrom(token.tokens) };
    case "list": {
      const list = token as AnyToken & { ordered: boolean; items: AnyToken[] };
      return { type: "list", ordered: list.ordered, items: list.items.map(itemInline) };
    }
    case "blockquote": {
      const paragraphs = ((token.tokens ?? []) as AnyToken[])
        .filter((child) => child.type === "paragraph" || child.type === "text")
        .map((child) => inlineFrom(child.tokens ?? [child]));
      return paragraphs.length > 0 ? { type: "quote", paragraphs } : null;
    }
    case "space":
    case "hr":
      return null;
    case "html":
    case "code":
      return { type: "paragraph", children: textNodes((token.text ?? token.raw ?? "").trim()) };
    default:
      return token.tokens ? { type: "paragraph", children: inlineFrom(token.tokens) } : null;
  }
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "edit":
          return node.text;
        case "break":
          return " ";
        default:
          return plainText(node.children);
      }
    })
    .join("");
}

function slugify(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "section";
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

/** Turns the Markdown text into the pieces the landing page is built from. */
export function parseLanding(markdown: string, fileLabel: string): LandingContent {
  const tokens = new Lexer().lex(markdown) as AnyToken[];

  let headline: Inline[] | null = null;
  const intro: Block[] = [];
  const sections: Section[] = [];
  const usedIds = new Set<string>(["signup"]);
  let section: Section | null = null;
  let card: Extract<Block, { type: "card" }> | null = null;

  for (const token of tokens) {
    if (token.type === "heading") {
      const depth = (token as AnyToken & { depth: number }).depth;
      const title = inlineFrom(token.tokens);
      if (depth === 1) {
        if (headline) throw new ContentError(`${fileLabel} has more than one "# " headline. Keep one, at the top.`);
        if (section) throw new ContentError(`${fileLabel}: the "# " headline must come before the first "## " section.`);
        headline = title;
        continue;
      }
      if (!headline) throw new ContentError(`${fileLabel} must start with a headline: a line beginning with "# ".`);
      if (depth === 2) {
        section = { id: slugify(plainText(title), usedIds), title, blocks: [] };
        sections.push(section);
        card = null;
        continue;
      }
      // "###" and deeper become a card inside the current section.
      card = { type: "card", title, blocks: [] };
      (section ? section.blocks : intro).push(card);
      continue;
    }

    if (token.type === "hr") {
      // A line of three dashes ends the current card.
      card = null;
      continue;
    }

    const block = blockFrom(token);
    if (!block) continue;
    if (!headline) throw new ContentError(`${fileLabel} must start with a headline: a line beginning with "# ".`);
    if (card) card.blocks.push(block);
    else if (section) section.blocks.push(block);
    else intro.push(block);
  }

  if (!headline) throw new ContentError(`${fileLabel} must start with a headline: a line beginning with "# ".`);
  const headlineText = plainText(headline).trim();
  if (headlineText === "") throw new ContentError(`${fileLabel}: the headline is empty.`);

  const firstParagraph = intro.find((block) => block.type === "paragraph");
  return {
    headline,
    headlineText,
    summaryText: firstParagraph && firstParagraph.type === "paragraph" ? plainText(firstParagraph.children).trim() : "",
    intro,
    sections,
    editMarkers: countEditMarkers(markdown),
  };
}

export type LandingKind = "owner" | "tradie";

export function landingFile(kind: LandingKind): string {
  return path.join(process.cwd(), "content", `landing-${kind}.md`);
}

/** Reads and parses one landing page's copy for a market. */
export function loadLanding(kind: LandingKind, market: Market): LandingContent {
  const fileLabel = `content/landing-${kind}.md`;
  let raw: string;
  try {
    raw = fs.readFileSync(landingFile(kind), "utf8");
  } catch {
    throw new ContentError(`${fileLabel} is missing. It holds the words for the ${kind} landing page.`);
  }
  return parseLanding(fillTokens(raw, contentTokens(market), fileLabel), fileLabel);
}
