/**
 * Font loading. next/font needs static import names, so when `brand.fonts` changes,
 * change the two imports below to match (names from https://fonts.google.com, with
 * spaces replaced by underscores).
 */
import { Barlow_Condensed, Inter } from "next/font/google";

export const headingFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
