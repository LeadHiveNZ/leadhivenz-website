"use client";

import { useEffect, useState } from "react";
import { removePushAction, savePushAction } from "@/app/actions/push";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type State = "checking" | "unsupported" | "iphone_install" | "off" | "on" | "blocked" | "busy";

/**
 * "Turn on notifications" (DECISIONS.md, 2026-11-20, third entry). On an
 * iPhone, notifications only work once HostFix is on the home screen, so that
 * comes first. With notifications on, a tradie's offers come as a notification
 * first (the text follows a few minutes later only if the offer is unopened),
 * and an owner's updates come as notifications instead of texts.
 */
export function NotificationsPrompt({ publicKey, audience }: { publicKey: string; audience: "tradie" | "owner" }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState(iphone && !standalone ? "iphone_install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    })().catch(() => {
      if (!cancelled) setState("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setState("busy");
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const saved = await savePushAction(JSON.parse(JSON.stringify(subscription)));
      if (!saved.ok) throw new Error(saved.message ?? "Could not save.");
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "blocked" : "off");
      setMessage("Notifications were not turned on. Try again, or check your phone's settings for this site.");
    }
  }

  async function turnOff() {
    setState("busy");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await removePushAction(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
  }

  if (state === "checking" || state === "unsupported") return null;
  const why =
    audience === "tradie"
      ? "Job offers reach you first as a notification. If you have not opened an offer after a few minutes, the text comes too."
      : "Updates about your jobs come as notifications instead of texts.";
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-[0.95rem]" data-testid="notifications-prompt">
      {state === "on" ? (
        <p className="text-ink">
          Notifications are on for this phone.{" "}
          <button type="button" onClick={turnOff} className="font-semibold text-brand underline underline-offset-2">
            Turn off
          </button>
        </p>
      ) : state === "iphone_install" ? (
        <p className="text-ink">
          <strong>Get notifications on your iPhone:</strong> tap the Share button, then &ldquo;Add to Home Screen&rdquo;. Open HostFix from your home screen and turn notifications on there.
        </p>
      ) : state === "blocked" ? (
        <p className="text-ink">Notifications are blocked for this site. You can allow them in your phone&rsquo;s settings. Until then we text you.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink">
            <strong>Turn on notifications.</strong> {why} On an iPhone, add HostFix to your home screen first.
          </p>
          <button type="button" onClick={turnOn} disabled={state === "busy"} className="rounded-full bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60">
            {state === "busy" ? "Turning on..." : "Turn on notifications"}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-alert">{message}</p>}
    </div>
  );
}
