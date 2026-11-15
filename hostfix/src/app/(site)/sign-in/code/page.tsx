import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { finishSignIn, resendCode } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Notice } from "@/components/ui/Bits";
import { openPending, PENDING_COOKIE } from "@/lib/auth/pending";
import { appSecret } from "@/lib/env";
import { displayPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false } };

export default function CodePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
      <h1 className="display text-4xl text-ink">Enter your code</h1>
      <Suspense fallback={<p className="mt-4 text-muted">One moment...</p>}>
        <CodeForm />
      </Suspense>
    </main>
  );
}

function masked(kind: "email" | "phone", value: string): string {
  if (kind === "phone") return displayPhone(value);
  const [name = "", domain = ""] = value.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

async function CodeForm() {
  const cookieStore = await cookies();
  const secret = appSecret();
  const pending = secret ? openPending(secret, cookieStore.get(PENDING_COOKIE)?.value) : null;
  if (!pending) {
    return (
      <div className="mt-4 space-y-4">
        <Notice tone="warn" title="That code has run out">
          Codes last 15 minutes. Start again and we will send a new one.
        </Notice>
        <Link href="/sign-in" className="font-semibold text-brand underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }
  const where = masked(pending.identifier.kind, pending.identifier.value);
  return (
    <>
      <p className="mt-2 text-muted">
        We sent a six-digit code to <strong className="text-ink">{where}</strong>. It works for 10 minutes.
      </p>
      {pending.demoCode && (
        <div className="mt-4">
          <Notice tone="info" title="Demo mode">
            No text or email service is connected, so nothing was really sent. Your code is{" "}
            <strong className="tabular text-lg tracking-widest text-ink" data-demo-code>
              {pending.demoCode}
            </strong>
          </Notice>
        </div>
      )}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <ActionForm action={finishSignIn}>
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} placeholder="123456" />
          <SubmitButton pendingLabel="Checking..." className="w-full">
            {pending.purpose === "owner_sign_up" ? "Create my account" : "Sign in"}
          </SubmitButton>
        </ActionForm>
      </div>
      <div className="mt-5">
        <ActionForm action={resendCode} className="space-y-2">
          <SubmitButton variant="small" pendingLabel="Sending...">
            Send a new code
          </SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
