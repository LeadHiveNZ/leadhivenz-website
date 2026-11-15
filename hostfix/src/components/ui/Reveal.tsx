import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A line you tap to open. Used to keep rarely needed or serious actions
 * (cancel, replace a link) one step away, so they are not pressed by mistake.
 * It works without JavaScript.
 */
export function Reveal({ label, children, tone = "quiet", open }: { label: ReactNode; children: ReactNode; tone?: "quiet" | "alert"; open?: boolean }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface" open={open}>
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden ${tone === "alert" ? "text-alert" : "text-ink"}`}>
        <span>{label}</span>
        <Icon name="chevron" size={18} className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
