import { brand } from "@config/brand";

/**
 * A clearly marked placeholder for a legal page. The real wording must be
 * written by a lawyer. See docs/LEGAL-TODO.md for the brief to give them.
 */
export function LegalPlaceholder({ title }: { title: string }) {
  const contact = brand.contact.email.includes("[EDIT") ? null : brand.contact.email;
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="inline-flex rounded-full bg-yellow-200 px-3 py-1 text-sm font-semibold text-ink">Placeholder page</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <div className="mt-5 space-y-4 text-lg text-muted">
          <p>This page is being written and is not final. It will be published here before {brand.name} launches.</p>
          {contact && (
            <p>
              Questions in the meantime? Email{" "}
              <a href={`mailto:${contact}`} className="font-medium text-brand underline">
                {contact}
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
