import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { CSSProperties, ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { brand } from "@config/brand";
import { baseUrl, demoModeAllowed } from "@/lib/env";
import "./globals.css";

// The headline typeface: a heavy grotesque with some character. The file ships
// with the site, so nothing is fetched from a font service.
const display = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-display-face",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: {
    default: `${brand.name} | ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  openGraph: {
    siteName: brand.name,
    type: "website",
    locale: "en_NZ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.colours.brand,
};

/** The brand colours from config/brand.ts, handed to the stylesheet. */
const brandColours = {
  "--hf-brand": brand.colours.brand,
  "--hf-brand-dark": brand.colours.brandDark,
  "--hf-accent": brand.colours.accent,
  "--hf-accent-dark": brand.colours.accentDark,
  "--hf-ink": brand.colours.ink,
  "--hf-muted": brand.colours.muted,
  "--hf-surface": brand.colours.surface,
  "--hf-tint": brand.colours.tint,
  "--hf-sand": brand.colours.sand,
  "--hf-line": brand.colours.line,
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NZ" className={`${GeistSans.variable} ${display.variable} h-full antialiased`} style={brandColours}>
      <body className="flex min-h-full flex-col font-sans">
        {/* Demo mode only (never on the live site): a strip saying so, with a way back to the demo menu. */}
        {demoModeAllowed() && (
          <a href="/demo" className="no-print flex items-center justify-center gap-2 bg-brand-dark px-4 py-1.5 text-xs font-bold text-white">
            <span className="rounded-full bg-accent px-2 py-0.5 text-brand-dark">DEMO</span>
            <span>Nothing here is real. Tap for the demo menu.</span>
          </a>
        )}
        {children}
      </body>
    </html>
  );
}
