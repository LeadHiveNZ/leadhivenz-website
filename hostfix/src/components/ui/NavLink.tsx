"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A navigation link that knows when it is the page you are on. */
export function NavLink({ href, exact, variant, children }: { href: string; exact?: boolean; variant: "top" | "bottom"; children: ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  if (variant === "top") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition ${active ? "bg-tint text-brand" : "text-muted hover:bg-tint/60 hover:text-ink"}`}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-16 flex-col items-center gap-1 px-2 pt-2.5 pb-2 text-[0.7rem] font-bold ${active ? "text-brand" : "text-muted"}`}
    >
      {children}
    </Link>
  );
}
