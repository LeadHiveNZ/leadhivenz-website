"use client";

import { useEffect } from "react";

/**
 * Starts the page at the top. After a form is sent, the browser can keep the
 * scroll position of the long page the form was on, and on a short page that
 * means the visitor lands looking at the footer instead of what they asked for.
 */
export function ScrollToTop() {
  useEffect(() => {
    // Instant, not the page's smooth scrolling: a glide up from the footer is the thing to avoid.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return null;
}
