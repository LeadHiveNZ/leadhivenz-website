import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SignOut } from "@/components/ui/SignOut";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The owner's part of the app. Each page inside checks the sign-in for itself. */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      home="/app"
      nav={[
        { href: "/app", label: "Home", icon: "home", exact: true },
        { href: "/app/jobs", label: "Jobs", icon: "jobs" },
        { href: "/app/properties", label: "Properties", icon: "property" },
        { href: "/app/account", label: "Account", icon: "account" },
      ]}
      primary={{ href: "/app/jobs/new", label: "Report", icon: "plus" }}
      right={<SignOut />}
    >
      {children}
    </AppShell>
  );
}
