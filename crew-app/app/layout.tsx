import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { bodyFont, headingFont } from "@/config/fonts";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${brand.appName} · ${brand.name}`, template: `%s · ${brand.name}` },
  description: `Today's jobs, photos and hours for the ${brand.name} crew.`,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: brand.shortName },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: brand.colours.primary,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const cssVars = {
  "--brand-primary": brand.colours.primary,
  "--brand-accent": brand.colours.accent,
  "--brand-background": brand.colours.background,
  "--brand-surface": brand.colours.surface,
  "--brand-success": brand.colours.success,
  "--brand-danger": brand.colours.danger,
  "--brand-text": brand.colours.text,
  "--brand-muted": brand.colours.muted,
  "--brand-border": brand.colours.border,
} as React.CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ" className={`${headingFont.variable} ${bodyFont.variable}`} style={cssVars}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
