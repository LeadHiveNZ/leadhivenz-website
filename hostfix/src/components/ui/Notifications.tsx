import { pushSettings } from "@/lib/notify/push";
import { NotificationsPrompt } from "./NotificationsPrompt";

/** The "Turn on notifications" card, shown only once the app-notification keys are set (SETUP.md). */
export function Notifications({ audience }: { audience: "tradie" | "owner" }) {
  const settings = pushSettings();
  if ("problem" in settings) return null;
  return <NotificationsPrompt publicKey={settings.publicKey} audience={audience} />;
}
