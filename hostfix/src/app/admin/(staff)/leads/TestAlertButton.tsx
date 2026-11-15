"use client";

import { useActionState } from "react";
import { sendTestAlert, type TestAlertState } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms/SubmitButton";

const initialState: TestAlertState = {};

function Line({ label, outcome }: { label: string; outcome: NonNullable<TestAlertState["sms"]> }) {
  const tone = outcome.status === "sent" ? "text-brand-dark" : outcome.status === "failed" ? "text-red-700" : "text-muted";
  const word = outcome.status === "sent" ? "Sent" : outcome.status === "failed" ? "Failed" : "Not sent";
  return (
    <li>
      <span className="font-semibold text-ink">{label}:</span> <span className={`font-semibold ${tone}`}>{word}.</span> {outcome.detail}
    </li>
  );
}

/** Sends a test text and email so the alert setup can be checked in one tap. */
export function TestAlertButton() {
  const [state, formAction] = useActionState(sendTestAlert, initialState);
  return (
    <form action={formAction}>
      <SubmitButton variant="secondary" pendingLabel="Sending test...">
        Send me a test alert
      </SubmitButton>
      {(state.sms || state.email) && (
        <ul role="status" className="mt-3 space-y-1 text-sm text-muted">
          {state.sms && <Line label="Text" outcome={state.sms} />}
          {state.email && <Line label="Email" outcome={state.email} />}
        </ul>
      )}
    </form>
  );
}
