"use client";

import { useEffect, useState } from "react";
import { HONEYPOT_FIELD } from "@/lib/leads/form-state";
import { captureAttribution } from "./attribution";

/**
 * The parts of a lead form the visitor never sees:
 *  - where they came from (for the "source" column on the leads list)
 *  - when the form appeared (robots submit instantly, people do not)
 *  - a trap field that only robots fill in
 */
export function LeadFormHiddenFields() {
  const [attribution, setAttribution] = useState("");
  const [startedAt, setStartedAt] = useState("");

  useEffect(() => {
    // These values only exist in the browser, so they are filled in after the
    // page has loaded. Held in state so they survive a failed submit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(captureAttribution());
    setStartedAt(String(Date.now()));
  }, []);

  return (
    <>
      <input type="hidden" name="attribution" value={attribution} readOnly />
      <input type="hidden" name="startedAt" value={startedAt} readOnly />
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}

/** Put once in the site layout so the arrival details are saved on the first page seen. */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
