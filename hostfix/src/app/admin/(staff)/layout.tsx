import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SignOut } from "@/components/ui/SignOut";
import { currentStaff } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { countOpenExceptions } from "@/lib/ops/exceptions";

/** How many things are waiting in the queue, shown on the Queue tab. Only for signed-in staff. */
async function OpenCount() {
  const staff = await currentStaff();
  if (!staff) return null;
  let open = 0;
  try {
    open = await countOpenExceptions(await getDb());
  } catch {
    return null;
  }
  if (open === 0) return null;
  return (
    <span className="tabular rounded-full bg-alert px-1.5 py-0.5 text-[0.7rem] font-bold text-white" aria-label={`${open} waiting`}>
      {open}
    </span>
  );
}

/** The frame for the dispatcher and the admin. Each page inside checks the sign-in for itself. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      home="/admin/queue"
      area="Team"
      wide
      nav={[
        {
          href: "/admin/queue", label: "Queue", icon: "queue",
          badge: (
            <Suspense fallback={null}>
              <OpenCount />
            </Suspense>
          ),
        },
        { href: "/admin/jobs", label: "Jobs", icon: "jobs" },
        { href: "/admin/tradies", label: "Tradies", icon: "tradie" },
        { href: "/admin/dashboard", label: "Numbers", icon: "chart" },
        { href: "/admin/more", label: "More", icon: "settings" },
      ]}
      right={<SignOut />}
    >
      {children}
    </AppShell>
  );
}
