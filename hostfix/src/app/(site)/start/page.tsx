import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentStaff, currentViewer, homeFor } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Opening...", robots: { index: false } };

/** Where the installed app opens. Sends each person to their own part of it. */
export default function StartPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center text-muted">
      <Suspense fallback={<p>Opening...</p>}>
        <Go />
      </Suspense>
    </main>
  );
}

async function Go(): Promise<never> {
  const viewer = await currentViewer();
  if (viewer) {
    const home = homeFor(viewer);
    redirect(home === "/start" ? "/sign-up" : home);
  }
  if (await currentStaff()) redirect("/admin/queue");
  redirect("/sign-in");
}
