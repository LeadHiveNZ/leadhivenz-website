import { savePin } from "@/app/actions/owner";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { FAR_METRES } from "@/lib/jobs/arrival";
import type { MapTiles } from "@/lib/maps/tiles";
import type { Property } from "@/lib/properties/service";
import { PinMap } from "./PinMap";

/**
 * Where the house is, for checking tradies' taps (DECISIONS.md, 2026-11-19).
 * Prominent until the owner has confirmed the pin; after that, one tap away.
 */
export function PinCard({ property, centre, tiles }: { property: Property; centre: { lat: number; lng: number } | null; tiles: MapTiles }) {
  const form = (
    <ActionForm action={savePin} className="space-y-3">
      <input type="hidden" name="propertyId" value={property.id} />
      <PinMap initial={property.pin} centre={centre} tiles={tiles} />
      <SubmitButton pendingLabel="Saving..." className="w-full">
        {property.pinConfirmedAt ? "Save the pin" : "Yes, the pin is on the house"}
      </SubmitButton>
    </ActionForm>
  );
  if (property.pinConfirmedAt) {
    return (
      <Reveal label="The map pin for this house">
        <p className="mb-3 text-muted">When a tradie taps Arrived and Job done, we check they are within {FAR_METRES} m of this pin.</p>
        {form}
      </Reveal>
    );
  }
  return (
    <Card className="border-brand/30 sm:p-6">
      <SectionTitle>Check where the house is</SectionTitle>
      <p className="mb-3 text-muted">
        {property.pin
          ? "We found this address on the map. If the pin is not on the house, drag it there, then press the button."
          : property.pinLookupAt
            ? "We could not find this address on the map. Tap the map where the house is, or press “I’m at the property now” when you are there."
            : "Tap the map where the house is, or press “I’m at the property now” when you are there."}{" "}
        When a tradie taps Arrived and Job done, we check they are within {FAR_METRES} m of it.
      </p>
      {form}
    </Card>
  );
}
