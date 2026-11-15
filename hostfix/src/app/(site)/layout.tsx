import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { AttributionCapture } from "@/components/forms/HiddenFields";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { MetaPixel } from "@/components/tracking/MetaPixel";

/** Everything the public sees: header, footer, tracking. The admin pages do not use this. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
      <AttributionCapture />
      <MetaPixel />
      <Analytics />
    </>
  );
}
