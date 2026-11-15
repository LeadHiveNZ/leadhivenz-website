import type { ReactNode } from "react";
import type { LandingContent } from "@/lib/content";
import { Blocks, InlineText } from "./content/RichText";
import { buttonClass } from "./forms/styles";
import { StickyCta } from "./StickyCta";

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
};

/**
 * The shared layout for the owner and tradie landing pages. The words come
 * from the Markdown files in /content. The form sits beside the headline on a
 * computer and straight under it on a phone.
 */
export function LandingPage({ content, eyebrow, formTitle, formNote, form, ctaLabel, closingTitle, closingNote }: Props) {
  return (
    <main className="pb-20 lg:pb-0">
      <section className="bg-tint">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-16">
          <div>
            <p className="inline-flex rounded-full border border-brand/20 bg-surface px-3 py-1 text-sm font-semibold text-brand-dark">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[1.875rem] leading-[1.12] font-semibold tracking-tight text-ink sm:mt-4 sm:text-5xl sm:leading-[1.08]">
              <InlineText nodes={content.headline} />
            </h1>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted sm:mt-5 sm:space-y-5 sm:text-lg">
              <Blocks blocks={content.intro} />
            </div>
          </div>

          <div id="signup" className="scroll-mt-6 lg:pt-2">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-ink/5 sm:p-7">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{formTitle}</h2>
              <p className="mt-1 text-sm text-muted">{formNote}</p>
              <div className="mt-5">{form}</div>
            </div>
          </div>
        </div>
      </section>

      {content.sections.map((section, index) => (
        <section key={section.id} id={section.id} className={`scroll-mt-6 ${index % 2 === 0 ? "bg-surface" : "bg-sand"}`}>
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              <InlineText nodes={section.title} />
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted">
              <Blocks blocks={section.blocks} />
            </div>
          </div>
        </section>
      ))}

      <section className="bg-ink">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{closingTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/75">{closingNote}</p>
          <a href="#signup" className={`${buttonClass} mt-7`}>
            {ctaLabel}
          </a>
        </div>
      </section>

      <StickyCta label={ctaLabel} />
    </main>
  );
}
