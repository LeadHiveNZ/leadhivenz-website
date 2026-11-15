"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Props = { href: string; exact?: boolean; variant: "top" | "bottom"; children: ReactNode };

function look(variant: "top" | "bottom", active: boolean): string {
  if (variant === "top") {
    return `inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition ${active ? "bg-tint text-brand" : "text-muted hover:bg-tint/60 hover:text-ink"}`;
  }
  return `flex min-w-16 flex-col items-center gap-1 px-2 pt-2.5 pb-2 text-[0.7rem] font-bold ${active ? "text-brand" : "text-muted"}`;
}

function Live({ href, exact, variant, children }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={look(variant, active)}>
      {children}
    </Link>
  );
}

/**
 * A navigation link that knows when it is the page you are on. On pages
 * whose address is only known when someone visits (a particular job, a
 * particular property), it first appears as a plain link and lights up a
 * moment later.
 */
export function NavLink(props: Props) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={look(props.variant, false)}>
          {props.children}
        </Link>
      }
    >
      <Live {...props} />
    </Suspense>
  );
}
