import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SignOut } from "@/components/ui/SignOut";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The tradie's part of the app. Each page inside checks the sign-in for itself. */
export default function TradieLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      home="/tradie"
      area="Tradie"
      nav={[
        { href: "/tradie", label: "Offers", icon: "offers", exact: true },
        { href: "/tradie/jobs", label: "My jobs", icon: "jobs" },
        { href: "/tradie/pay", label: "Pay", icon: "pay" },
        { href: "/tradie/profile", label: "Profile", icon: "account" },
      ]}
      right={<SignOut />}
    >
      {children}
    </AppShell>
  );
}
