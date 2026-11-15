import type { MetadataRoute } from "next";
import { brand } from "@config/brand";

/**
 * Lets the site be added to a phone's home screen and open like an app, with
 * its own icon and no browser bar. No app store involved.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.colours.sand,
    theme_color: brand.colours.brand,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
