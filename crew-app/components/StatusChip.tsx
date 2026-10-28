import { brand } from "@/config/brand";
import { STATUS_LABEL, type JobStatus } from "@/lib/types";

export function statusColours(status: JobStatus): { bg: string; fg: string } {
  switch (status) {
    case "on_the_way":
      return { bg: brand.colours.primary, fg: "#fff" };
    case "on_site":
      return { bg: brand.colours.accent, fg: "#fff" };
    case "done":
      return { bg: brand.colours.success, fg: "#fff" };
    default:
      return { bg: "#E5E7EB", fg: brand.colours.text };
  }
}

export function StatusChip({ status, className = "" }: { status: JobStatus; className?: string }) {
  const c = statusColours(status);
  return (
    <span className={`chip ${className}`} style={{ background: c.bg, color: c.fg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}
