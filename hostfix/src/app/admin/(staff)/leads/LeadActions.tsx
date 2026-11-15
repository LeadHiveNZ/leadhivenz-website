"use client";

import { useActionState } from "react";
import { inviteLead, tradieFromLead } from "@/app/actions/staff-admin";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { FormState } from "@/lib/forms";

type Props = { leadId: string; leadType: "owner" | "tradie"; converted: boolean; invited: boolean; live: boolean };

const start: FormState = {};

/** What can be done with one lead: invite an owner to join once their area is open, or make a tradie lead a tradie. */
export function LeadActions({ leadId, leadType, converted, invited, live }: Props) {
  const [inviteState, invite] = useActionState(inviteLead, start);
  const [tradieState, makeTradie] = useActionState(tradieFromLead, start);
  if (converted) return <p className="mt-2 text-xs font-semibold text-done">{leadType === "owner" ? "Has joined" : "On the tradie list"}</p>;
  const state = leadType === "owner" ? inviteState : tradieState;
  return (
    <div className="mt-2 space-y-1.5">
      {leadType === "tradie" ? (
        <form action={makeTradie}>
          <input type="hidden" name="leadId" value={leadId} />
          <SubmitButton variant="small" pendingLabel="Adding...">
            Make a tradie
          </SubmitButton>
        </form>
      ) : live ? (
        <form action={invite}>
          <input type="hidden" name="leadId" value={leadId} />
          <SubmitButton variant="small" pendingLabel="Sending...">
            {invited || inviteState.done ? "Invite again" : "Invite to join"}
          </SubmitButton>
        </form>
      ) : null}
      {state.message && <p className="text-xs font-semibold text-red-700">{state.message}</p>}
      {state.done && <p className="text-xs font-semibold text-done">{state.done}</p>}
      {leadType === "owner" && invited && !inviteState.done && <p className="text-xs text-muted">Invited</p>}
    </div>
  );
}
