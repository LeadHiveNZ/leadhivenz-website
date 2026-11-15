import { TestAlertButton } from "@/app/admin/(staff)/leads/TestAlertButton";
import type { StatusItem } from "@/lib/status";

const STATE_STYLE: Record<StatusItem["state"], { dot: string; word: string }> = {
  ok: { dot: "bg-brand", word: "Ready" },
  todo: { dot: "bg-wait", word: "To do" },
  problem: { dot: "bg-red-600", word: "Needs fixing" },
};

/** Every account and setting the site needs, and whether each one is ready. */
export function SetupChecklist({ items }: { items: StatusItem[] }) {
  const done = items.filter((item) => item.state === "ok").length;
  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-lg font-semibold text-ink">
            Setup checklist
          </h2>
          <p className="text-sm text-muted">
            {done} of {items.length} ready. SETUP.md has the steps for each one.
          </p>
        </div>
        <TestAlertButton />
      </div>
      <ul className="mt-4 divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3 py-3" data-status={item.state} data-status-key={item.key}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATE_STYLE[item.state].dot}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {item.label} <span className="font-normal text-muted">· {STATE_STYLE[item.state].word}</span>
              </p>
              <p className="text-sm text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
