import type { Metadata } from "next";
import Link from "next/link";
import { Chip, EmptyState, PageTitle } from "@/components/ui/Bits";
import { requireStaff } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets/store";
import { listMessages } from "@/lib/notify/outbox";
import { displayPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Texts and emails" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const all = await listMessages(db, { limit: 300 });
  const onlyFailed = query.show === "failed";
  const messages = onlyFailed ? all.filter((message) => message.status === "failed") : all;
  const zone = (await listMarkets(db))[0]?.timezone ?? "Pacific/Auckland";
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Texts and emails" back={{ href: "/admin/more", label: "More" }} intro="The last 300 messages the system sent. Sign-in codes and one-tap links are blanked out once a message has gone." />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/messages" className={pill(!onlyFailed)}>
          All
        </Link>
        <Link href="/admin/messages?show=failed" className={pill(onlyFailed)}>
          Failed ({all.filter((message) => message.status === "failed").length})
        </Link>
      </div>
      {messages.length === 0 ? (
        <EmptyState icon="phone" title={onlyFailed ? "Nothing has failed" : "Nothing has been sent yet"} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {messages.map((message) => (
            <li key={message.id} className="px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink">
                  {message.channel === "sms" ? "Text" : "Email"} to {message.channel === "sms" ? displayPhone(message.recipient) : message.recipient}
                </span>
                <span className="text-muted">{message.template.replace(/_/g, " ")}</span>
                <Chip tone={message.status === "sent" ? "done" : message.status === "failed" ? "alert" : message.status === "demo" ? "quiet" : "waiting"}>
                  {message.status === "demo" ? "Demo: not really sent" : message.status}
                </Chip>
                <span className="tabular ml-auto text-muted">{formatDateTime(message.createdAt, zone)}</span>
              </p>
              {message.body && <p className="mt-1 text-sm whitespace-pre-line text-muted">{message.subject ? `${message.subject}\n` : ""}{message.body}</p>}
              {message.error && <p className="mt-1 text-sm font-semibold text-alert">{message.error}</p>}
              {message.jobId && (
                <Link href={`/admin/jobs/${message.jobId}`} className="mt-1 inline-block text-sm font-semibold text-brand underline underline-offset-2">
                  Open the job
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
