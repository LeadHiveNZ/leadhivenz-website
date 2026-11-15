"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const VALID = /^\d{5,20}$/.test(PIXEL_ID);

/**
 * The Meta Pixel. Loads only when NEXT_PUBLIC_META_PIXEL_ID is set, and only
 * on the public pages (never on the admin pages). Records a page view on each
 * page, including when moving between pages without a full reload.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const firstPage = useRef(true);

  useEffect(() => {
    if (!VALID) return;
    if (firstPage.current) {
      // The snippet below already records the first page view.
      firstPage.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  if (!VALID) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
    </Script>
  );
}
