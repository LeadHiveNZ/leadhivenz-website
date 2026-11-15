import { randomBytes } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { secondaryButtonClass } from "@/components/forms/styles";
import { PlainShell } from "@/components/ui/PlainShell";
import { adminSettings } from "@/lib/auth/admin";
import { SignInForm } from "./SignInForm";

export default function AdminSignInPage() {
  return (
    <PlainShell>
      <div className="mx-auto max-w-sm pt-6">
        <h1 className="display text-4xl text-ink">Team sign-in</h1>

        <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <p className="font-bold text-ink">Dispatcher or admin</p>
          <p className="mt-1 text-muted">Sign in with your own email address. We send you a six-digit code. There is no password.</p>
          <Link href="/sign-in?next=/admin/queue" className={`${secondaryButtonClass} mt-4 w-full`}>
            Sign in with my email
          </Link>
        </div>

        <div className="mt-5 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <p className="font-bold text-ink">Business owner</p>
          <p className="mt-1 mb-4 text-muted">The admin password always works, even before any staff have been added.</p>
          <Suspense fallback={null}>
            <SetupNotice />
          </Suspense>
          <SignInForm />
        </div>
      </div>
    </PlainShell>
  );
}

/** Shown only until the sign-in settings exist. Explains exactly what to add. */
async function SetupNotice() {
  await connection();
  const result = adminSettings();
  if ("settings" in result) return null;
  const suggestion = randomBytes(32).toString("base64url");
  return (
    <div className="mb-4 rounded-2xl border border-wait/40 bg-wait-soft p-4 text-sm text-ink">
      <p className="font-semibold">The admin password is not set up yet</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {result.problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p className="mt-3 text-muted">Add these in your hosting settings (Vercel: Settings, then Environment Variables), then redeploy. SETUP.md walks through it.</p>
      <p className="mt-3 text-muted">Need a value for APP_SECRET? Here is a fresh random one you can copy:</p>
      <code className="mt-1 block rounded-lg bg-tint px-3 py-2 font-mono text-xs break-all">{suggestion}</code>
    </div>
  );
}
