import Link from "next/link";
import { brand } from "@config/brand";
import { Logo } from "./Logo";

const isPlaceholder = (value: string) => value.includes("[EDIT");

/** The dark band at the foot of the public pages. */
export function SiteFooter() {
  const email = brand.contact.email;
  const link = "text-white/75 underline-offset-4 hover:text-white hover:underline";
  return (
    <footer className="on-dark no-print mt-auto bg-brand-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo tone="light" />
          <p className="max-w-xs text-sm text-white/70">{brand.tagline}</p>
          <div className="space-y-1 text-sm text-white/70">
            {!isPlaceholder(brand.legalName) && <p>{brand.legalName}</p>}
            {!isPlaceholder(email) && (
              <p>
                <a href={`mailto:${email}`} className={link}>
                  {email}
                </a>
              </p>
            )}
            {brand.contact.phone && <p>{brand.contact.phone}</p>}
          </div>
        </div>
        <nav aria-label="For owners" className="space-y-2 text-sm">
          <p className="font-bold text-white">Owners</p>
          <p><Link href="/owners" className={link}>How it works</Link></p>
          <p><Link href="/sign-up" className={link}>Join</Link></p>
          <p><Link href="/sign-in" className={link}>Sign in</Link></p>
        </nav>
        <nav aria-label="For tradies and cleaners" className="space-y-2 text-sm">
          <p className="font-bold text-white">Tradies and cleaners</p>
          <p><Link href="/tradies" className={link}>Get jobs</Link></p>
          <p><Link href="/refer" className={link}>Refer an owner</Link></p>
          <p><Link href="/sign-in" className={link}>Sign in</Link></p>
        </nav>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="font-bold text-white">The small print</p>
          <p><Link href="/legal/terms" className={link}>Terms</Link></p>
          <p><Link href="/legal/privacy" className={link}>Privacy</Link></p>
          <p><Link href="/legal/tradie-agreement" className={link}>Tradie agreement</Link></p>
          <p><Link href="/legal/insurance" className={link}>Insurance</Link></p>
        </nav>
      </div>
    </footer>
  );
}
