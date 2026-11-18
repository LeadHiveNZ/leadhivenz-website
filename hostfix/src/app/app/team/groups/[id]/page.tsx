import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteGroupAction, saveGroup } from "@/app/actions/team";
import { ActionForm, CheckList, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice, PageTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listProperties } from "@/lib/properties/service";
import { getGroup, listTeam } from "@/lib/team/service";

export const metadata: Metadata = { title: "Group" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** One group of properties: rename it, choose its houses, see who is assigned to it. */
export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/team/groups/${id}`);
  const query = await searchParams;
  const db = await getDb();
  const group = await getGroup(db, viewer.ownerId, id);
  if (!group) notFound();
  const [all, team] = await Promise.all([listProperties(db, viewer.ownerId), listTeam(db, viewer.ownerId)]);
  const properties = all.filter((property) => property.status !== "cancelled" || group.propertyIds.includes(property.id));
  const assigned = team.filter((member) => member.groupIds.includes(group.id));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageTitle
        title={group.name}
        back={{ href: "/app/team", label: "Your team" }}
        intro={assigned.length > 0 ? `Assigned to ${assigned.map((member) => member.name).join(", ")}.` : "Nobody is assigned to this group yet. Tick it on a team member to give them every house in it."}
      />
      {query.added && <Notice tone="good" title="Group made" />}
      <Card className="sm:p-6">
        <ActionForm action={saveGroup} className="space-y-4">
          <input type="hidden" name="groupId" value={group.id} />
          <Field label="Group name" name="name" required maxLength={60} defaultValue={group.name} />
          <CheckList
            name="propertyIds"
            legend="Houses in it"
            defaultValues={group.propertyIds}
            options={properties.map((property) => ({ key: property.id, label: property.name, detail: property.suburb }))}
          />
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save changes
          </SubmitButton>
        </ActionForm>
      </Card>
      <Reveal label="Delete this group" tone="alert">
        <ActionForm action={deleteGroupAction} className="space-y-3">
          <input type="hidden" name="groupId" value={group.id} />
          <p className="text-muted">The houses stay. Anyone who had them only through this group loses them from their list.</p>
          <SubmitButton variant="danger" pendingLabel="Deleting...">
            Yes, delete the group
          </SubmitButton>
        </ActionForm>
      </Reveal>
    </div>
  );
}
