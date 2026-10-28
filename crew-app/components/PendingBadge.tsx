"use client";
import { useEffect, useState } from "react";
import { onOutboxChange, outboxCount } from "@/lib/offline/db";
import { onSyncDone, startSyncLoop } from "@/lib/offline/sync";

/** "Saved on phone, will upload" badge. Shows whenever anything is waiting to sync. */
export function PendingBadge() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    startSyncLoop();
    const refresh = () => outboxCount().then(setCount).catch(() => {});
    refresh();
    const off1 = onOutboxChange(refresh);
    const off2 = onSyncDone(refresh);
    const setNet = () => setOnline(navigator.onLine);
    setNet();
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    return () => {
      off1();
      off2();
      window.removeEventListener("online", setNet);
      window.removeEventListener("offline", setNet);
    };
  }, []);

  if (count === 0 && online) return null;
  return (
    <div
      className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
      role="status"
    >
      {count > 0 ? `Saved on phone, will upload (${count})` : "No signal — working offline"}
    </div>
  );
}
