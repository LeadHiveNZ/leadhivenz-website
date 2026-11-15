import { appIcon } from "@/lib/brand/icon";

// Large home-screen icon and splash screen.
export function GET() {
  return appIcon(512, { padding: 0.2 });
}
