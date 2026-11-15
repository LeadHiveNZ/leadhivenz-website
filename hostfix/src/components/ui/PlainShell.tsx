import type { ReactNode } from "react";
import { Logo } from "../Logo";

/**
 * The frame for pages opened from a text or a QR code by someone with no
 * account: just the logo and the page. Nothing to get lost in.
 */
export function PlainShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print border-b border-line bg-sand">
        <div className={`mx-auto flex h-14 items-center px-4 sm:px-6 ${wide ? "max-w-3xl" : "max-w-xl"}`}>
          <Logo size={26} />
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 pt-6 pb-16 sm:px-6 ${wide ? "max-w-3xl" : "max-w-xl"}`}>{children}</main>
    </div>
  );
}
