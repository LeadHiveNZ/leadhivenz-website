import type { Metadata } from "next";
import { SetupChecklist } from "@/components/admin/SetupChecklist";
import { PageTitle } from "@/components/ui/Bits";
import { requireAdminRole } from "@/lib/auth/current";
import { setupStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage() {
  await requireAdminRole();
  const status = await setupStatus();
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Setup checklist" back={{ href: "/admin/more", label: "More" }} intro="Every account and key the site needs, and whether each one is connected. SETUP.md has the steps, in order." />
      <SetupChecklist items={status} />
    </div>
  );
}
