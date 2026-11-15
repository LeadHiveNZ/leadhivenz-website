import type { Metadata } from "next";
import { PageTitle, RowLink } from "@/components/ui/Bits";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SignOut } from "@/components/ui/SignOut";
import { requireStaff } from "@/lib/auth/current";

export const metadata: Metadata = { title: "More" };

type Item = { href: string; title: string; subtitle: string; icon: IconName; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/admin/owners", title: "Owners", subtitle: "Their properties and jobs. Give a credit. Log a job they phone in.", icon: "people" },
  { href: "/admin/messages", title: "Texts and emails", subtitle: "Everything the system has sent, and anything that failed.", icon: "phone" },
  { href: "/admin/markets", title: "Markets, prices and the menu", subtitle: "Change a price, edit the menu, add a town.", icon: "market", adminOnly: true },
  { href: "/admin/leads", title: "Leads", subtitle: "Owners and tradies from the public pages. Invite them in.", icon: "offers", adminOnly: true },
  { href: "/admin/referrals", title: "Referrals", subtitle: "Rewards owed to cleaners and co-hosts.", icon: "gift", adminOnly: true },
  { href: "/admin/staff", title: "Staff", subtitle: "Add or remove a dispatcher or admin.", icon: "account", adminOnly: true },
  { href: "/admin/audit", title: "Audit log", subtitle: "Every job change and every money movement, in order.", icon: "log", adminOnly: true },
  { href: "/admin/setup", title: "Setup checklist", subtitle: "Which accounts and keys are connected.", icon: "settings", adminOnly: true },
];

export default async function MorePage() {
  const staff = await requireStaff();
  const items = ITEMS.filter((item) => !item.adminOnly || staff.role === "admin");
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="More" intro={`Signed in as ${staff.name} (${staff.role}).`} />
      <div className="space-y-2.5">
        {items.map((item) => (
          <RowLink
            key={item.href}
            href={item.href}
            title={item.title}
            subtitle={item.subtitle}
            leading={
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                <Icon name={item.icon} />
              </span>
            }
          />
        ))}
      </div>
      <div className="mt-6 md:hidden">
        <SignOut full />
      </div>
    </div>
  );
}
