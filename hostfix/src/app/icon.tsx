import { ImageResponse } from "next/og";
import { brand } from "@config/brand";

// The small icon shown in the browser tab: the first letter of the brand name
// on the brand colour, both taken from config/brand.ts.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.colours.brand,
          color: "#ffffff",
          fontSize: 44,
          fontWeight: 700,
          borderRadius: 14,
        }}
      >
        {brand.name.charAt(0).toUpperCase()}
      </div>
    ),
    size,
  );
}
