import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { Icon, type IconName } from "./Icon";
import { NavLink } from "./NavLink";

export type NavItem = { href: string; label: string; icon: IconName; /** Match this path exactly rather than everything under it. */ exact?: boolean; badge?: number };

type Props = {
  /** Where the logo goes. */
  home: string;
  /** A short word beside the logo saying which part of the app this is. */
  area?: string;
  nav: NavItem[];
  /** The one main thing to do, shown as a raised button in the middle of the phone's bottom bar. */
  primary?: { href: string; label: string; icon: IconName };
  /** Shown at the right of the top bar: usually the person's name and a way to sign out. */
  right?: ReactNode;
  children: ReactNode;
  /** Wider pages for staff tables. */
  wide?: boolean;
};

/**
 * The frame around every signed-in screen. On a phone the navigation is a bar
 * along the bottom, where a thumb reaches it. On a computer it runs across
 * the top.
 */
export function AppShell({ home, area, nav, primary, right, children, wide }: Props) {
  const half = Math.ceil(nav.length / 2);
  const left = primary ? nav.slice(0, half) : nav;
  const rightSide = primary ? nav.slice(half) : [];
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-sand/95 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
          <Link href={home} className="flex items-center gap-2" aria-label="Home">
            <Logo size={26} />
            {area && <span className="rounded-full bg-tint px-2.5 py-0.5 text-xs font-bold tracking-wide text-brand uppercase">{area}</span>}
          </Link>
          <nav aria-label="Main" className="ml-2 hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} exact={item.exact} variant="top">
                {item.label}
                {item.badge ? <span className="tabular ml-1.5 rounded-full bg-alert px-1.5 py-0.5 text-[0.7rem] font-bold text-white">{item.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {primary && (
              <Link href={primary.href} className="hidden min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark md:inline-flex">
                <Icon name={primary.icon} size={18} /> {primary.label}
              </Link>
            )}
            {right}
          </div>
        </div>
      </header>

      <div className={`mx-auto w-full flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-12 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</div>

      <nav aria-label="Main" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <div className="mx-auto flex max-w-md items-end justify-around px-1">
          {left.map((item) => (
            <NavLink key={item.href} href={item.href} exact={item.exact} variant="bottom">
              <span className="relative">
                <Icon name={item.icon} size={22} />
                {item.badge ? <span className="tabular absolute -top-1.5 -right-2.5 rounded-full bg-alert px-1 text-[0.65rem] font-bold text-white">{item.badge}</span> : null}
              </span>
              {item.label}
            </NavLink>
          ))}
          {primary && (
            <Link href={primary.href} className="-mt-5 flex flex-col items-center gap-1 px-2 pb-2 text-[0.7rem] font-bold text-brand">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-accent shadow-lg ring-4 shadow-brand/25 ring-surface">
                <Icon name={primary.icon} size={26} />
              </span>
              {primary.label}
            </Link>
          )}
          {rightSide.map((item) => (
            <NavLink key={item.href} href={item.href} exact={item.exact} variant="bottom">
              <span className="relative">
                <Icon name={item.icon} size={22} />
                {item.badge ? <span className="tabular absolute -top-1.5 -right-2.5 rounded-full bg-alert px-1 text-[0.65rem] font-bold text-white">{item.badge}</span> : null}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
