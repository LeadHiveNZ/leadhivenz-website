import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PlainShell } from "@/components/ui/PlainShell";

export const metadata: Metadata = { title: "Report a problem", robots: { index: false, follow: false } };

export default function ReportLayout({ children }: { children: ReactNode }) {
  return <PlainShell>{children}</PlainShell>;
}
