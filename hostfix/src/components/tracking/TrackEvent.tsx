"use client";

import { useEffect } from "react";

type Props = {
  /** A standard Meta event name, for example Lead or Purchase. */
  name: string;
  /** The same id the server sends to Meta, so the two are counted once. */
  eventId: string;
  params?: Record<string, string | number>;
};

/**
 * Tells the Meta Pixel that something happened (a lead, a deposit). It fires
 * once per visit even if the page is refreshed, and does nothing when the
 * pixel is not installed.
 */
export function TrackEvent({ name, eventId, params }: Props) {
  useEffect(() => {
    const key = `hf_tracked_${name}_${eventId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      // No storage available: carry on and send the event.
    }

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      if (typeof window.fbq === "function") {
        window.fbq("track", name, params ?? {}, { eventID: eventId });
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // ignore
        }
        return;
      }
      // The pixel script may still be loading. Try for about five seconds.
      attempts += 1;
      if (attempts < 20) timer = setTimeout(send, 250);
    };
    send();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // The event is defined by its name and id. Params never change for the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, eventId]);

  return null;
}
