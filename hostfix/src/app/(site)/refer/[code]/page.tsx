import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { buttonClass } from "@/components/forms/styles";
import { Notice } from "@/components/ui/Bits";
import { CopyButton, ShareButton } from "@/components/ui/Buttons";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Your link", robots: { index: false, follow: false } };

/** A cleaner's own link, to pass on to owners. Nothing private is shown here: only the link itself. */
export default function ReferLinkPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
      <Suspense fallback={<p className="text-muted">One moment...</p>}>
        <YourLink params={params} />
      </Suspense>
    </main>
  );
}

async function YourLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await connection();
  const clean = code.toUpperCase();
  const found = /^[A-Z0-9]{5,12}$/.test(clean) ? await (await getDb()).query<{ name: string }>("select name from public.referrers where code = $1", [clean]) : [];
  if (!found[0]) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">We cannot find that link</h1>
        <Link href="/refer" className="font-semibold text-brand underline underline-offset-2">
          Get a link
        </Link>
      </div>
    );
  }
  const link = `${baseUrl()}/sign-up?ref=${clean}`;
  const first = found[0].name.split(" ")[0] ?? found[0].name;
  return (
    <div className="space-y-5">
      <h1 className="display text-4xl text-ink">Here is your link, {first}</h1>
      <p className="text-lg text-muted">Send it to the owners you clean or co-host for. When one joins from it and stays a member, you are paid.</p>
      <p className="rounded-2xl bg-tint px-4 py-3 font-mono text-sm break-all text-ink">{link}</p>
      <div className="flex flex-wrap gap-2">
        <ShareButton className={buttonClass} label="Send it to an owner" url={link} text={`I use ${brand.name} to get things fixed at the places I look after. A tradie is sent as soon as I report a problem. Join here:`} />
        <CopyButton text={link} label="Copy the link" />
      </div>
      <Notice tone="info" title="We have texted you this link too">
        Keep the text and you can find it again any time.
      </Notice>
    </div>
  );
}
