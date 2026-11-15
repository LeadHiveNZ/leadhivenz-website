import type { ReactNode } from "react";
import type { Block, Inline, LandingContent, Section } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { Blocks, InlineText } from "./content/RichText";
import { accentButtonClass } from "./forms/styles";
import { StickyCta } from "./StickyCta";
import { Icon } from "./ui/Icon";

export type MenuPreview = {
  title: string;
  note: string;
  currency: string;
  /** Leave prices out until the menu is final. */
  showPrices: boolean;
  priceLabel: string;
  items: { name: string; cents: number }[];
};

type Props = {
  content: LandingContent;
  /** The small line above the headline, for example "Queenstown, New Zealand". */
  eyebrow: string;
  formTitle: string;
  formNote: string;
  form: ReactNode;
  /** The words on the buttons that jump to the form. */
  ctaLabel: string;
  closingTitle: string;
  closingNote: string;
  /** Three short facts shown under the headline. Only ever true things about how the product works. */
  proof: { value: string; label: string }[];
  /** A picture of the product, shown beside the steps. */
  phone: ReactNode;
  menu?: MenuPreview | null;
};

/**
 * The shared layout for the owner and tradie landing pages.
 *
 * The words come from the Markdown files in /content. This file decides how
 * each section looks from what is in it, so the copy can be edited freely:
 *
 *   a numbered list          numbered steps beside the phone picture
 *   a "> quote"              the dark promise band
 *   "###" cards, questions   an FAQ that opens and closes
 *   "###" cards, otherwise   price cards side by side
 *   bullet points            a grid of cards
 *   anything else            plain paragraphs
 */
export function LandingPage({ content, eyebrow, formTitle, formNote, form, ctaLabel, closingTitle, closingNote, proof, phone, menu }: Props) {
  let stepsShown = false;
  let pricingShown = false;
  return (
    <main className="pb-20 lg:pb-0">
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/35 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute top-40 -left-40 h-80 w-80 rounded-full bg-tint blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-10 sm:px-6 sm:pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:pt-16 lg:pb-16">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-white">
              <Icon name="market" size={16} className="text-accent" />
              {eyebrow}
            </p>
            <h1 className="display mt-4 text-[2.35rem] text-ink sm:text-[3.4rem] lg:text-[3.9rem]">
              <InlineText nodes={content.headline} />
            </h1>
            <div className="mt-5 max-w-xl space-y-4 text-lg leading-relaxed text-muted">
              <Blocks blocks={content.intro} />
            </div>
          </div>

          <div id="signup" className="scroll-mt-20 lg:pt-1">
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-brand/10 sm:p-7">
              <h2 className="display text-2xl text-ink">{formTitle}</h2>
              <p className="mt-1.5 text-sm text-muted">{formNote}</p>
              <div className="mt-5">{form}</div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:pb-14">
          <dl className="grid gap-3 sm:grid-cols-3">
            {proof.map((fact) => (
              <div key={fact.label} className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4">
                <dd className="display tabular order-first text-4xl text-brand">{fact.value}</dd>
                <dt className="text-sm leading-snug font-semibold text-muted">{fact.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {content.sections.map((section) => {
        const kind = kindOf(section);
        if (kind === "steps" && !stepsShown) {
          stepsShown = true;
          return <Steps key={section.id} section={section} phone={phone} />;
        }
        if (kind === "promise") return <Promise key={section.id} section={section} />;
        if (kind === "faq") return <Faq key={section.id} section={section} />;
        if (kind === "pricing" && !pricingShown) {
          pricingShown = true;
          return <Pricing key={section.id} section={section} menu={menu ?? null} />;
        }
        if (kind === "features") return <Features key={section.id} section={section} />;
        return <Prose key={section.id} section={section} />;
      })}

      <section className="on-dark bg-brand-dark">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="display text-3xl text-white sm:text-5xl">{closingTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">{closingNote}</p>
          <a href="#signup" className={`${accentButtonClass} mt-8`}>
            {ctaLabel} <Icon name="arrow" size={18} />
          </a>
        </div>
      </section>

      <StickyCta label={ctaLabel} />
    </main>
  );
}

type Kind = "steps" | "promise" | "faq" | "pricing" | "features" | "prose";

function kindOf(section: Section): Kind {
  const blocks = section.blocks;
  if (blocks.some((block) => block.type === "list" && block.ordered)) return "steps";
  if (blocks.some((block) => block.type === "quote")) return "promise";
  const cards = blocks.some((block) => block.type === "card");
  if (cards && /question|faq|ask/.test(section.id)) return "faq";
  if (cards) return "pricing";
  if (blocks.some((block) => block.type === "list")) return "features";
  return "prose";
}

function Heading({ section, light = false }: { section: Section; light?: boolean }) {
  return (
    <h2 className={`display text-3xl sm:text-[2.6rem] ${light ? "text-white" : "text-ink"}`}>
      <InlineText nodes={section.title} />
    </h2>
  );
}

const shell = "mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20";

/** Splits "**The 9pm text.** You're hours away..." into its bold lead and the rest. */
function leadAndRest(item: Inline[]): { lead: Inline[] | null; rest: Inline[] } {
  const [first, ...rest] = item;
  if (first?.type === "strong") return { lead: first.children, rest };
  return { lead: null, rest: item };
}

function Steps({ section, phone }: { section: Section; phone: ReactNode }) {
  const list = section.blocks.find((block): block is Extract<Block, { type: "list" }> => block.type === "list" && block.ordered);
  const others = section.blocks.filter((block) => block !== list);
  return (
    <section id={section.id} className="scroll-mt-16 bg-surface">
      <div className={`${shell} grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16`}>
        <div>
          <Heading section={section} />
          <ol className="mt-8 space-y-4">
            {list?.items.map((item, index) => {
              const { lead, rest } = leadAndRest(item);
              return (
                <li key={index} className="flex gap-4 rounded-2xl border border-line bg-sand/60 p-4 sm:p-5">
                  <span aria-hidden="true" className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-brand-dark">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[1.05rem] leading-relaxed text-muted">
                    {lead && (
                      <span className="block text-lg font-bold text-ink">
                        <InlineText nodes={lead} />
                      </span>
                    )}
                    <InlineText nodes={rest} />
                  </span>
                </li>
              );
            })}
          </ol>
          {others.length > 0 && (
            <div className="mt-6 space-y-4 text-lg text-muted">
              <Blocks blocks={others} />
            </div>
          )}
        </div>
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-x-6 top-10 bottom-10 rounded-[3rem] bg-tint" />
          <div className="relative py-4">{phone}</div>
        </div>
      </div>
    </section>
  );
}

function Features({ section }: { section: Section }) {
  const items = section.blocks.flatMap((block) => (block.type === "list" ? block.items : []));
  const others = section.blocks.filter((block) => block.type !== "list");
  return (
    <section id={section.id} className="scroll-mt-16">
      <div className={shell}>
        <Heading section={section} />
        {others.length > 0 && (
          <div className="mt-4 max-w-2xl space-y-4 text-lg text-muted">
            <Blocks blocks={others} />
          </div>
        )}
        <ul className={`mt-8 grid gap-4 ${items.length % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {items.map((item, index) => {
            const { lead, rest } = leadAndRest(item);
            return (
              <li key={index} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <span aria-hidden="true" className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-tint text-brand">
                  <Icon name="check" size={18} />
                </span>
                {lead && (
                  <p className="text-lg font-bold text-ink">
                    <InlineText nodes={lead} />
                  </p>
                )}
                <p className={`leading-relaxed text-muted ${lead ? "mt-1" : "text-lg"}`}>
                  <InlineText nodes={rest} />
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Pricing({ section, menu }: { section: Section; menu: MenuPreview | null }) {
  const cards = section.blocks.filter((block): block is Extract<Block, { type: "card" }> => block.type === "card");
  const before = section.blocks.slice(0, section.blocks.findIndex((block) => block.type === "card"));
  const after = section.blocks.slice(section.blocks.findLastIndex((block) => block.type === "card") + 1);
  return (
    <section id={section.id} className="scroll-mt-16 bg-surface">
      <div className={shell}>
        <Heading section={section} />
        {before.length > 0 && (
          <div className="mt-4 max-w-2xl space-y-4 text-lg text-muted">
            <Blocks blocks={before} />
          </div>
        )}
        <div className={`mt-8 grid gap-4 ${cards.length > 1 ? "md:grid-cols-2" : ""}`}>
          {cards.map((card, index) => (
            <div key={index} className={`rounded-3xl p-6 sm:p-8 ${index === cards.length - 1 && cards.length > 1 ? "on-dark bg-brand text-white" : "border border-line bg-sand/70"}`}>
              <h3 className={`display text-2xl sm:text-[1.7rem] ${index === cards.length - 1 && cards.length > 1 ? "text-white" : "text-ink"}`}>
                <InlineText nodes={card.title} />
              </h3>
              <div className={`mt-3 space-y-3 text-lg leading-relaxed ${index === cards.length - 1 && cards.length > 1 ? "text-white/80 [&_strong]:text-white" : "text-muted"}`}>
                <Blocks blocks={card.blocks} />
              </div>
            </div>
          ))}
        </div>
        {after.length > 0 && (
          <div className="mt-6 max-w-3xl space-y-4 text-lg text-muted">
            <Blocks blocks={after} />
          </div>
        )}

        {menu && menu.items.length > 0 && (
          <div className="mt-12 rounded-3xl border border-line bg-sand/70 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="display text-2xl text-ink sm:text-3xl">{menu.title}</h3>
              {menu.showPrices && <p className="text-sm font-semibold text-muted">{menu.priceLabel}</p>}
            </div>
            <p className="mt-2 max-w-2xl text-muted">{menu.note}</p>
            <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
              {menu.items.map((item) => (
                <li key={item.name} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                  <span className="text-ink">{item.name}</span>
                  {menu.showPrices && <span className="tabular shrink-0 font-bold text-ink">{formatMoney(item.cents, menu.currency)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Promise({ section }: { section: Section }) {
  const quote = section.blocks.find((block): block is Extract<Block, { type: "quote" }> => block.type === "quote");
  const others = section.blocks.filter((block) => block !== quote);
  return (
    <section id={section.id} className="on-dark scroll-mt-16 bg-brand">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-brand-dark">
          <Icon name="shield" size={28} />
        </span>
        <p className="mt-5 text-sm font-bold tracking-[0.18em] text-accent uppercase">
          <InlineText nodes={section.title} />
        </p>
        {quote?.paragraphs.map((paragraph, index) => (
          <p key={index} className="display mt-4 text-[1.9rem] leading-[1.1] text-white sm:text-[2.75rem]">
            <InlineText nodes={paragraph} />
          </p>
        ))}
        {others.length > 0 && (
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg text-white/75 [&_strong]:text-white">
            <Blocks blocks={others} />
          </div>
        )}
      </div>
    </section>
  );
}

function Faq({ section }: { section: Section }) {
  const cards = section.blocks.filter((block): block is Extract<Block, { type: "card" }> => block.type === "card");
  return (
    <section id={section.id} className="scroll-mt-16">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <Heading section={section} />
        <div className="mt-8 space-y-3">
          {cards.map((card, index) => (
            <details key={index} className="group rounded-2xl border border-line bg-surface px-5 py-4 open:shadow-sm sm:px-6">
              <summary className="flex items-center justify-between gap-4 text-lg font-bold text-ink">
                <span>
                  <InlineText nodes={card.title} />
                </span>
                <Icon name="chevron" className="chevron text-brand transition-transform" />
              </summary>
              <div className="mt-3 space-y-3 text-[1.05rem] leading-relaxed text-muted">
                <Blocks blocks={card.blocks} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Prose({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-16">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <Heading section={section} />
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted">
          <Blocks blocks={section.blocks} />
        </div>
      </div>
    </section>
  );
}
