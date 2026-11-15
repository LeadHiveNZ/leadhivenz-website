import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PlainShell } from "@/components/ui/PlainShell";

export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <PlainShell wide>{children}</PlainShell>;
}
