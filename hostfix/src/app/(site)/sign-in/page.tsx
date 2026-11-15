import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { startSignIn } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { safeNext } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
      <h1 className="display text-4xl text-ink">Sign in</h1>
      <p className="mt-2 text-muted">Enter your email or mobile and we will send you a six-digit code. There is no password to remember.</p>
      <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <ActionForm action={startSignIn}>
          <Suspense fallback={null}>
            <Next searchParams={searchParams} />
          </Suspense>
          <Field label="Email or mobile number" name="identifier" autoComplete="username" required maxLength={254} placeholder="you@example.com or 021 123 4567" />
          <SubmitButton pendingLabel="Sending your code..." className="w-full">
            Send me a code
          </SubmitButton>
        </ActionForm>
      </div>
      <div className="mt-6 space-y-2 text-muted">
        <p>
          Own a holiday home and new here?{" "}
          <Link href="/sign-up" className="font-semibold text-brand underline underline-offset-2">
            Join
          </Link>
        </p>
        <p>
          A tradie who wants jobs?{" "}
          <Link href="/tradies" className="font-semibold text-brand underline underline-offset-2">
            Put your name down
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Remembers the page the person was trying to reach, so they land there after signing in. */
async function Next({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const next = safeNext((await searchParams).next, "");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}
