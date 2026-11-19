"use server";

import { currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { removePushSubscriptions, savePushSubscription, type PushSubscriptionInput } from "@/lib/notify/push";

/** "Turn on notifications": saves this phone's subscription for the signed-in person only. */
export async function savePushAction(subscription: PushSubscriptionInput): Promise<{ ok: boolean; message?: string }> {
  const viewer = await currentViewer();
  if (!viewer) return { ok: false, message: "Sign in first." };
  return savePushSubscription(await getDb(), viewer.user.id, subscription);
}

/** "Turn off notifications" on this phone. */
export async function removePushAction(endpoint: string): Promise<{ ok: boolean }> {
  const viewer = await currentViewer();
  if (!viewer) return { ok: false };
  await removePushSubscriptions(await getDb(), viewer.user.id, typeof endpoint === "string" ? endpoint.slice(0, 1100) : undefined);
  return { ok: true };
}
