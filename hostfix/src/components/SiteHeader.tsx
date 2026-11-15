import Link from "next/link";
import { brand } from "@config/brand";
import { LogoMark } from "./Logo";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-ink">
          <LogoMark />
          {brand.name}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
          <Link href="/owners" className="rounded-lg px-3 py-2 text-muted hover:bg-tint hover:text-ink">
            Owners
          </Link>
          <Link href="/tradies" className="rounded-lg px-3 py-2 text-muted hover:bg-tint hover:text-ink">
            Tradies
          </Link>
        </nav>
      </div>
    </header>
  );
}
