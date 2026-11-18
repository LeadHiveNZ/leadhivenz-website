import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { removeTeamMemberAction, saveTeamMember } from "@/app/actions/team";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice, PageTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { MemberFields } from "@/components/team/MemberFields";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { displayPhone } from "@/lib/phone";
import { listProperties } from "@/lib/properties/service";
import { CopyButton } from "@/components/ui/Buttons";
import { getTeamMember, linkTokenFor, listGroups, teamLinkUrl } from "@/lib/team/service";

export const metadata: Metadata = { title: "Team member" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** One cleaner or co-host: their houses, their groups, what happens when they report, and taking them off the team. */
export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/team/${id}`);
  const query = await searchParams;
  const db = await getDb();
  const member = await getTeamMember(db, viewer.ownerId, id);
  if (!member) notFound();
  const [groups, all, token] = await Promise.all([listGroups(db, viewer.ownerId), listProperties(db, viewer.ownerId), linkTokenFor(db, viewer.ownerId, member.id)]);
  const link = token ? teamLinkUrl(token) : null;
  const properties = all.filter((property) => property.status !== "cancelled" || member.propertyIds.includes(property.id));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageTitle title={member.name} back={{ href: "/app/team", label: "Your team" }} intro={displayPhone(member.phone)} />
      {query.added && (
        <Notice tone="good" title="Added">
          We have texted {member.name} their link. They open it once and type the code we send them, then they can report from it.
        </Notice>
      )}
      {link && (
        <Card>
          <p className="font-semibold text-ink">Their link</p>
          <p className="mt-1 text-sm text-muted">The same link for every owner they work for. It only opens on a phone that has typed the code we text to {displayPhone(member.phone)}.</p>
          <p className="mt-3 rounded-xl bg-tint px-3 py-2 font-mono text-sm break-all text-ink" data-team-link>
            {link}
          </p>
          <div className="mt-3">
            <CopyButton text={link} label="Copy their link" />
          </div>
        </Card>
      )}
      <Card className="sm:p-6">
        <ActionForm action={saveTeamMember} className="space-y-4">
          <input type="hidden" name="memberId" value={member.id} />
          <MemberFields properties={properties} groups={groups} withPhone={false} defaults={member} />
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save changes
          </SubmitButton>
        </ActionForm>
      </Card>
      <Reveal label="Take off my team" tone="alert">
        <ActionForm action={removeTeamMemberAction} className="space-y-3">
          <input type="hidden" name="memberId" value={member.id} />
          <p className="text-muted">Your houses go from their list straight away. Reports they already sent stay on your jobs with their name.</p>
          <SubmitButton variant="danger" pendingLabel="Removing...">
            Yes, take {member.name} off my team
          </SubmitButton>
        </ActionForm>
      </Reveal>
    </div>
  );
}
