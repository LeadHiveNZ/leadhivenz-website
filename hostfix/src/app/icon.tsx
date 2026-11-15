import { appIcon } from "@/lib/brand/icon";

// The small icon in the browser tab.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon(64, { padding: 0.12, rounded: true });
}
