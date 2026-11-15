import { appIcon } from "@/lib/brand/icon";

// Home-screen icon for Android and the installed app.
export function GET() {
  return appIcon(192, { padding: 0.2 });
}
