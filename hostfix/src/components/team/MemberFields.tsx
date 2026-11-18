import { CheckList, Field, RadioCards } from "@/components/forms/ActionForm";
import type { Property } from "@/lib/properties/service";
import type { Dispatch, PropertyGroup } from "@/lib/team/service";

/** Groups are shown only to owners with this many properties or more. One or two houses need no groups. */
export const GROUPS_FROM = 3;

/** The fields for adding or changing a cleaner or co-host: name, the houses, the groups, and what happens when they report. */
export function MemberFields({
  properties, groups, defaults, withPhone,
}: {
  properties: Property[];
  groups: PropertyGroup[];
  defaults?: { name: string; dispatch: Dispatch; propertyIds: string[]; groupIds: string[] };
  withPhone: boolean;
}) {
  const showGroups = properties.length >= GROUPS_FROM && groups.length > 0;
  return (
    <>
      <Field label="Their name" name="name" required maxLength={80} defaultValue={defaults?.name} placeholder="Mele" hint="Every report they send is signed with it." />
      {withPhone && (
        <Field label="Their mobile" name="phone" type="tel" inputMode="tel" autoComplete="off" required maxLength={30} placeholder="021 123 4567" hint="We text them their link. The link only opens on a phone that can get a code at this number." />
      )}
      {properties.length > 0 && (
        <CheckList
          name="propertyIds"
          legend="Which houses do they look after?"
          defaultValues={defaults?.propertyIds ?? (properties.length === 1 ? [properties[0]!.id] : [])}
          options={properties.map((property) => ({ key: property.id, label: property.name, detail: property.suburb }))}
        />
      )}
      {showGroups && (
        <CheckList
          name="groupIds"
          legend="Or whole groups"
          hint="A house you add to the group later is on their list straight away."
          defaultValues={defaults?.groupIds ?? []}
          options={groups.map((group) => ({ key: group.id, label: group.name, detail: `${group.propertyIds.length} ${group.propertyIds.length === 1 ? "house" : "houses"}` }))}
        />
      )}
      <RadioCards
        name="dispatch"
        legend="When they report a problem"
        defaultValue={defaults?.dispatch ?? "straight"}
        options={[
          { value: "straight", title: "Send a tradie straight away", detail: "You get a text to say it is on its way." },
          { value: "ask", title: "Ask me first", detail: "You get a text and nobody is sent until you say yes." },
        ]}
      />
    </>
  );
}
