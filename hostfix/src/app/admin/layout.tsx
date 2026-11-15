import type { Metadata } from "next";
import type { ReactNode } from "react";
import { brand } from "@config/brand";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** A plain frame for the private pages. No public header, no ad tracking. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-tint">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4 sm:px-6">
          <LogoMark size={28} />
          <span className="font-semibold text-ink">{brand.name}</span>
          <span className="rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-dark">Admin</span>
        </div>
      </header>
      {children}
    </div>
  );
}
