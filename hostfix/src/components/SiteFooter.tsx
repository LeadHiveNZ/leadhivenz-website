import Link from "next/link";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";

const isPlaceholder = (value: string) => value.includes("[EDIT");

export function SiteFooter() {
  const email = brand.contact.email;
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-ink">{brand.name}</p>
          <p>
            {launchMarket.name}, {launchMarket.countryName}
          </p>
          {!isPlaceholder(brand.legalName) && <p>{brand.legalName}</p>}
          {!isPlaceholder(email) && (
            <p>
              <a href={`mailto:${email}`} className="underline hover:text-ink">
                {email}
              </a>
            </p>
          )}
          {brand.contact.phone && <p>{brand.contact.phone}</p>}
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/legal/terms" className="underline hover:text-ink">
            Terms
          </Link>
          <Link href="/legal/privacy" className="underline hover:text-ink">
            Privacy
          </Link>
          <Link href="/legal/tradie-agreement" className="underline hover:text-ink">
            Tradie agreement
          </Link>
          <Link href="/legal/insurance" className="underline hover:text-ink">
            Insurance
          </Link>
        </nav>
      </div>
    </footer>
  );
}
