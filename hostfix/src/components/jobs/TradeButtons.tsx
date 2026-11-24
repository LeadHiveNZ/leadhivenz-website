import { staffChooseTrade } from "@/app/actions/staff";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { jobTrades } from "@config/trades";

/**
 * One tap to pick the trade for a job (DECISIONS.md, 2026-11-24): a "Not sure"
 * job, or one nobody in its trade could take. The job goes straight out to
 * that trade's tradies.
 */
export function TradeButtons({ jobId, current }: { jobId: string; current?: string }) {
  return (
    <ActionForm action={staffChooseTrade} className="mt-3 flex flex-wrap gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      {jobTrades
        .filter((trade) => trade.key !== current)
        .map((trade) => (
          <SubmitButton key={trade.key} name="trade" value={trade.key} variant="small" pendingLabel="Sending...">
            {trade.label}
          </SubmitButton>
        ))}
    </ActionForm>
  );
}
