import Link from "next/link";
import { Logo } from "./Logo";

/** The bar across the top of the public pages. */
export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-sand/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 text-sm font-semibold sm:gap-1">
          <Link href="/owners" className="rounded-full px-2.5 py-2 text-muted hover:bg-tint hover:text-ink sm:px-3">
            Owners
          </Link>
          <Link href="/tradies" className="rounded-full px-2.5 py-2 text-muted hover:bg-tint hover:text-ink sm:px-3">
            Tradies
          </Link>
          <Link href="/sign-in" className="ml-1 rounded-full border border-brand/25 bg-surface px-3.5 py-2 whitespace-nowrap text-brand hover:bg-tint sm:px-4">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
