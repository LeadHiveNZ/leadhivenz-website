"use client"; // Error screens must run in the browser.

import { useEffect } from "react";
import { buttonClass } from "@/components/forms/styles";

export default function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center bg-tint">
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Something went wrong on our side.</h1>
        <p className="mt-3 text-lg text-muted">Nothing was lost. Please try again.</p>
        <button type="button" onClick={() => retry()} className={`${buttonClass} mt-7`}>
          Try again
        </button>
      </div>
    </main>
  );
}
