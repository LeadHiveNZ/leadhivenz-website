import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Team", template: "%s | Team" },
  robots: { index: false, follow: false },
};

/** The private pages for the dispatcher and the admin. No public header, no ad tracking. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
