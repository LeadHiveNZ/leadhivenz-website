import type { Metadata } from "next";
import Link from "next/link";
import { addTeamMemberAction, createGroupAction } from "@/app/actions/team";
import { ActionForm, CheckList, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, EmptyState, Notice, PageTitle, RowLink, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { GROUPS_FROM, MemberFields } from "@/components/team/MemberFields";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { displayPhone } from "@/lib/phone";
import { listProperties } from "@/lib/properties/service";
import { housesCovered, listGroups, listTeam } from "@/lib/team/service";

export const metadata: Metadata = { title: "Your team" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The owner's cleaners and co-hosts, and (with three or more properties) their property groups. */
export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/team");
  const query = await searchParams;
  const db = await getDb();
  const [team, groups, all] = await Promise.all([listTeam(db, viewer.ownerId), listGroups(db, viewer.ownerId), listProperties(db, viewer.ownerId)]);
  const properties = all.filter((property) => property.status !== "cancelled");
  const showGroups = properties.length >= GROUPS_FROM;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title="Your team"
        back={{ href: "/app/properties", label: "Properties" }}
        intro="Cleaners and co-hosts who report problems for you. Each person gets one link that lists the houses you tick, and every report is signed with their name."
      />
      {query.removed && <Notice tone="good" title="Taken off your team">Your houses are gone from their list. Their link still works for any other owner who has added them.</Notice>}
      {query.group_deleted && <Notice tone="good" title="Group deleted">The houses in it are unchanged.</Notice>}

      <section>
        <SectionTitle>{team.length === 0 ? "Nobody yet" : `${team.length} ${team.length === 1 ? "person" : "people"}`}</SectionTitle>
        {team.length === 0 ? (
          <EmptyState icon="phone" title="Add your cleaner">
            They get a text with their own link. They open it once, type the code we text them, and from then on they can report a problem at any of your houses in a minute.
          </EmptyState>
        ) : (
          <div className="space-y-2.5">
            {team.map((member) => {
              const houses = housesCovered(member, groups);
              return (
                <RowLink
                  key={member.id}
                  href={`/app/team/${member.id}`}
                  title={member.name}
                  subtitle={`${displayPhone(member.phone)} · ${houses} ${houses === 1 ? "house" : "houses"} · ${member.dispatch === "ask" ? "Asks you first" : "Sends a tradie straight away"}`}
                  leading={
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                      <Icon name="account" />
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <Card className="sm:p-6">
        <SectionTitle>Add a cleaner or co-host</SectionTitle>
        {properties.length === 0 ? (
          <p className="text-muted">
            Add a property first, then come back to add the people who look after it.{" "}
            <Link href="/app/properties/new" className="font-semibold text-brand underline underline-offset-2">
              Add a property
            </Link>
          </p>
        ) : (
          <ActionForm action={addTeamMemberAction} className="space-y-4">
            <MemberFields properties={properties} groups={groups} withPhone />
            <SubmitButton pendingLabel="Adding..." className="w-full">
              Add and text them their link
            </SubmitButton>
          </ActionForm>
        )}
      </Card>

      {showGroups && (
        <section>
          <SectionTitle>Groups</SectionTitle>
          <p className="mb-3 text-muted">Put houses together, like all the ones in one suburb. Give a cleaner the group, and a house you add to it later is on their list straight away.</p>
          <div className="space-y-2.5">
            {groups.map((group) => (
              <RowLink
                key={group.id}
                href={`/app/team/groups/${group.id}`}
                title={group.name}
                subtitle={`${group.propertyIds.length} ${group.propertyIds.length === 1 ? "house" : "houses"}`}
              />
            ))}
          </div>
          <div className="mt-3">
            <Reveal label="Make a new group">
              <ActionForm action={createGroupAction} className="space-y-4">
                <Field label="Group name" name="name" required maxLength={60} placeholder="Frankton" />
                <CheckList name="propertyIds" legend="Houses in it" options={properties.map((property) => ({ key: property.id, label: property.name, detail: property.suburb }))} />
                <SubmitButton variant="secondary" pendingLabel="Saving...">
                  Make the group
                </SubmitButton>
              </ActionForm>
            </Reveal>
          </div>
        </section>
      )}
    </div>
  );
}
