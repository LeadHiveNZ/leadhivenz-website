import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/LegalPlaceholder";

// PLACEHOLDER. A lawyer must write this page. See docs/LEGAL-TODO.md.
export const metadata: Metadata = {
  title: "Privacy policy",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LegalPlaceholder title="Privacy policy" />;
}
