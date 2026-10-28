import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <Wordmark size="lg" />
      <h1 className="mt-6 text-3xl">No signal</h1>
      <p className="mt-2 text-muted">This page hasn&apos;t been saved on your phone yet. Your Today list and any job you&apos;ve opened still work.</p>
      <Link href="/today" className="btn btn-accent mt-6">
        Go to Today
      </Link>
    </main>
  );
}
