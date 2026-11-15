import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/LegalPlaceholder";

// PLACEHOLDER. A lawyer must write this page. See docs/LEGAL-TODO.md.
export const metadata: Metadata = {
  title: "Terms of service",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LegalPlaceholder title="Terms of service" />;
}
