import type { ReactNode } from "react";
import { brand } from "@config/brand";

/**
 * The shared look of the legal pages. Plain English, numbered sections,
 * a "last updated" line and a contact line at the end.
 *
 * These pages were written from what the software actually does
 * (docs/LEGAL-TODO.md). They are not legal advice. The plan in DECISIONS.md:
 * a free Community Law review before the first job, and a paid lawyer's
 * review at around 100 properties.
 */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: string; children: ReactNode }) {
  const contact = brand.contact.email.includes("[EDIT") ? null : brand.contact.email;
  return (
    <main className="flex-1 bg-sand">
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">{brand.name}</p>
        <h1 className="display mt-2 text-3xl text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <p className="mt-5 text-lg leading-relaxed text-ink">{intro}</p>
        <div className="legal mt-8 space-y-8 text-base leading-relaxed text-ink [&_h2]:display [&_h2]:text-xl [&_h2]:text-ink [&_h2]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:font-semibold">
          {children}
        </div>
        <footer className="mt-12 border-t border-line pt-6 text-sm text-muted">
          <p>
            {brand.legalName.includes("[EDIT") ? brand.name : brand.legalName}, trading as {brand.name}, New Zealand.
            {contact ? (
              <>
                {" "}
                Questions, requests or complaints about this page:{" "}
                <a href={`mailto:${contact}`} className="font-medium text-brand underline">
                  {contact}
                </a>
                .
              </>
            ) : null}
          </p>
          <p className="mt-2">
            If we cannot sort a privacy complaint with you, you can take it to the Office of the Privacy Commissioner (privacy.org.nz). For other complaints
            you can contact the Commerce Commission (comcom.govt.nz) or the Disputes Tribunal.
          </p>
        </footer>
      </article>
    </main>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`}>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
