import { randomBytes } from "node:crypto";
import { connection } from "next/server";
import { Suspense } from "react";
import { adminSettings } from "@/lib/auth/admin";
import { SignInForm } from "./SignInForm";

export default function AdminSignInPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-muted">This page is for the business owner.</p>
      <Suspense fallback={null}>
        <SetupNotice />
      </Suspense>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <SignInForm />
      </div>
    </main>
  );
}

/** Shown only until the sign-in settings exist. Explains exactly what to add. */
async function SetupNotice() {
  await connection();
  const result = adminSettings();
  if ("settings" in result) return null;
  const suggestion = randomBytes(32).toString("base64url");
  return (
    <div className="mt-6 rounded-2xl border border-accent bg-surface p-5 text-sm text-ink">
      <p className="font-semibold">Sign-in is not set up yet</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {result.problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p className="mt-3 text-muted">
        Add these in your hosting settings (Vercel: Settings, then Environment Variables), then redeploy. Step 3 of SETUP.md walks through it.
      </p>
      <p className="mt-3 text-muted">Need a value for APP_SECRET? Here is a fresh random one you can copy:</p>
      <code className="mt-1 block break-all rounded-lg bg-tint px-3 py-2 font-mono text-xs">{suggestion}</code>
    </div>
  );
}
