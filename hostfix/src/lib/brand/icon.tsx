import { ImageResponse } from "next/og";
import { brand } from "@config/brand";

/**
 * The app icon, drawn from the brand colours: the open-door mark on plum.
 * Used for the browser tab, the home-screen icon and the installable app.
 *
 * `padding` leaves a safe border, which phones need because they crop home
 * screen icons into circles and rounded squares.
 */
export function appIcon(size: number, options: { padding?: number; rounded?: boolean } = {}): ImageResponse {
  const pad = Math.round(size * (options.padding ?? 0.16));
  const inner = size - pad * 2;
  const c = brand.colours;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: c.brand,
          borderRadius: options.rounded ? Math.round(size * 0.22) : 0,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 64 64">
          <rect x="11" y="6" width="26" height="52" rx="4" fill={c.sand} />
          <path d="M37 6 L53 13 V51 L37 58 Z" fill={c.accent} stroke={c.brandDark} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="47" cy="33" r="2.6" fill={c.brandDark} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
