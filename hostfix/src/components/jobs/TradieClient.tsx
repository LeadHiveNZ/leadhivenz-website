"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, dangerButtonClass } from "../forms/styles";
import { Icon } from "../ui/Icon";

/**
 * A button that asks the phone where it is as it sends, so there is a record
 * that the tradie was at the property at that time: "I have arrived", "Job
 * done" and "I could not get in" (DECISIONS.md, 2026-11-19). If the phone will
 * not say, the button still works: no location is a flag for the owner to
 * check, never a reason to refuse the tap.
 */
export function LocatedButton({ label, busyLabel, variant = "primary", icon }: { label: string; busyLabel: string; variant?: "primary" | "danger"; icon?: "market" | "check" }) {
  const { pending } = useFormStatus();
  const [locating, setLocating] = useState(false);
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const asked = useRef(false);

  return (
    <>
      <input ref={lat} type="hidden" name="lat" />
      <input ref={lng} type="hidden" name="lng" />
      <button
        type="submit"
        disabled={pending || locating}
        aria-busy={pending || locating}
        className={`${variant === "danger" ? dangerButtonClass : buttonClass} w-full`}
        onClick={(event) => {
          if (asked.current || !("geolocation" in navigator)) return;
          event.preventDefault();
          asked.current = true;
          setLocating(true);
          const button = event.currentTarget;
          const send = () => {
            setLocating(false);
            button.form?.requestSubmit(button);
            // A refused form (no photo yet) can be sent again, asking the phone again.
            setTimeout(() => {
              asked.current = false;
            }, 1500);
          };
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (lat.current) lat.current.value = String(position.coords.latitude);
              if (lng.current) lng.current.value = String(position.coords.longitude);
              send();
            },
            send,
            { timeout: 5000, maximumAge: 60_000 },
          );
        }}
      >
        {icon && <Icon name={icon} size={20} />}
        {pending || locating ? busyLabel : label}
      </button>
    </>
  );
}

/** "I have arrived". */
export function ArrivedButton() {
  return <LocatedButton label="I have arrived" busyLabel="Marking you as arrived..." icon="market" />;
}

function left(until: number): string {
  const ms = until - Date.now();
  if (ms <= 0) return "";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return minutes > 0 ? `${minutes} min ${String(seconds).padStart(2, "0")} s` : `${seconds} s`;
}

/** Counts down to a moment, once a second. Shows the fallback until the page is live, and after time is up. */
export function Countdown({ until, fallback, done }: { until: string; fallback: string; done: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const target = new Date(until).getTime();
    const tick = () => setText(left(target));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return <span className="tabular">{text === null ? fallback : text === "" ? done : text}</span>;
}
