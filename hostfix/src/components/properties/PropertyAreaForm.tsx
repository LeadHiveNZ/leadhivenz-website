import { staffSetPropertyArea } from "@/app/actions/staff";
import { ActionForm, Select } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { ServiceArea } from "@config/markets";

/**
 * Staff set a property's service area (DECISIONS.md, 2026-11-26). Shown on the
 * admin owner page and, as a nudge, on a job whose property has none.
 */
export function PropertyAreaForm({ propertyId, area, areas, jobId }: { propertyId: string; area: string | null; areas: readonly ServiceArea[]; jobId?: string }) {
  if (areas.length === 0) return null;
  return (
    <ActionForm action={staffSetPropertyArea} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="propertyId" value={propertyId} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      <div className="min-w-56 flex-1">
        <Select
          label="Area"
          name="area"
          placeholder="Choose the area"
          defaultValue={area ?? "none"}
          options={[{ key: "none", label: "No area: offered to every tradie" }, ...areas.map((candidate) => ({ key: candidate.key, label: candidate.name }))]}
        />
      </div>
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        Save area
      </SubmitButton>
    </ActionForm>
  );
}
