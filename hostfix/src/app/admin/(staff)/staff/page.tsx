import type { Metadata } from "next";
import { addStaffMember, removeStaffMember } from "@/app/actions/staff-admin";
import { ActionForm, Field, RadioCards } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { requireAdminRole } from "@/lib/auth/current";
import { listStaff } from "@/lib/auth/staff";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireAdminRole();
  const staff = await listStaff(await getDb());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Staff"
        back={{ href: "/admin/more", label: "More" }}
        intro="Each person signs in with their own email and a code, so the audit log shows who did what, and one person's access can be removed without touching anyone else's."
      />

      <Card>
        <SectionTitle>Who has access</SectionTitle>
        {staff.length === 0 ? (
          <p className="text-muted">Nobody yet. You are signed in with the admin password, which always works.</p>
        ) : (
          <ul className="divide-y divide-line">
            {staff.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-ink">
                    {member.name} {member.userId === me.viewer?.user.id && <span className="font-normal text-muted">(you)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {member.email} · {member.lastSignInAt ? `last signed in ${formatDate(member.lastSignInAt, "Pacific/Auckland")}` : "has not signed in yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={member.disabled ? "quiet" : member.role === "admin" ? "brand" : "active"}>{member.disabled ? "Removed" : member.role}</Chip>
                  {!member.disabled && member.userId !== me.viewer?.user.id && (
                    <ActionForm action={removeStaffMember} className="">
                      <input type="hidden" name="userId" value={member.userId} />
                      <SubmitButton variant="small" pendingLabel="Removing...">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="sm:p-6">
        <SectionTitle>Add someone</SectionTitle>
        <ActionForm action={addStaffMember} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="staffName" required maxLength={80} />
            <Field label="Email" name="staffEmail" type="email" required maxLength={120} hint="They sign in with this." />
          </div>
          <RadioCards
            name="role"
            legend="What can they do?"
            defaultValue="dispatcher"
            options={[
              { value: "dispatcher", title: "Dispatcher", detail: "The queue, jobs, tradies and owners. Cannot change prices, markets or staff, and does not see the numbers." },
              { value: "admin", title: "Admin", detail: "Everything, including prices, markets, staff and the numbers." },
            ]}
          />
          <SubmitButton pendingLabel="Adding...">Add and email them</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
