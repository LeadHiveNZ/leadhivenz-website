import type { ReactNode } from "react";

/** The shared look of the "thank you" and confirmation pages. */
export function ThanksShell({ title, children, tone = "success" }: { title: string; children: ReactNode; tone?: "success" | "notice" }) {
  return (
    <main className="flex-1 bg-tint">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${tone === "success" ? "bg-brand" : "bg-accent"}`}
          aria-hidden="true"
        >
          {tone === "success" ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink" fill="none">
              <path d="M12 7v6m0 3.5v.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <div className="mt-4 space-y-5 text-lg text-muted">{children}</div>
      </div>
    </main>
  );
}

export function NextSteps({ steps }: { steps: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">What happens next</h2>
      <ol className="mt-3 space-y-3 text-base">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-semibold text-brand-dark"
            >
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
