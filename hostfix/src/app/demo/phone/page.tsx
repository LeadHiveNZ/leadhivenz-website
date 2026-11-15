import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { sendDemoReply } from "@/app/actions/demo";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Notice } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { getDb } from "@/lib/db";
import { demoPeople } from "@/lib/demo/state";
import { baseUrl, demoModeAllowed } from "@/lib/env";
import { listMessages } from "@/lib/notify/outbox";
import { displayPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const REPLIED: Record<string, string> = {
  accepted: "The reply took the job. A new text with the address has arrived.",
  passed: "The reply passed on the job. It has gone to the next tradie.",
  taken: "Too late: someone else had already taken it.",
  no_offer: "There was no offer waiting for an answer.",
  not_eligible: "They could not be given that job.",
  paused: "Offers are now paused for this tradie.",
  not_understood: "The reply was not understood.",
  unknown_sender: "That number is not a tradie's.",
};

/** Turns the links in a text into ones you can tap. Links to this site are made relative, so they work wherever the demo is being viewed. */
function withLinks(body: string, site: string): ReactNode[] {
  return body.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;
    const href = part.startsWith(site) ? part.slice(site.length) || "/" : part;
    return (
      <Link key={index} href={href} className="font-semibold break-all underline underline-offset-2">
        {part.replace(/^https?:\/\//, "")}
      </Link>
    );
  });
}

/** A pretend phone: the texts one person has been sent, newest at the bottom. */
export default async function DemoPhone({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  if (!demoModeAllowed()) notFound();
  const query = await searchParams;
  const db = await getDb();
  const people = (await demoPeople(db)).filter((person) => person.phone);
  const person = people.find((candidate) => candidate.key === query.who) ?? null;
  const texts = person?.phone ? (await listMessages(db, { recipient: person.phone, limit: 40 })).filter((message) => message.channel === "sms").reverse() : [];
  const site = baseUrl();
  const replied = typeof query.replied === "string" ? REPLIED[query.replied] : null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/demo" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <Icon name="back" size={16} /> Demo menu
        </Link>
        <h1 className="display text-4xl text-ink">Whose phone?</h1>
        <p className="mt-2 text-muted">These are the texts the system has sent each person. In the demo they are kept here instead of being sent.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {people.map((candidate) => (
          <Link
            key={candidate.key}
            href={`/demo/phone?who=${candidate.key}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${candidate.key === person?.key ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            {candidate.label}
          </Link>
        ))}
      </div>

      {replied && <Notice tone="info" title={replied} />}

      {person && (
        <div className="mx-auto w-full max-w-sm rounded-[2.2rem] border-[10px] border-brand-dark bg-white shadow-xl">
          <div className="rounded-t-[1.5rem] bg-tint px-4 py-3 text-center">
            <p className="font-bold text-ink">{person.label}</p>
            <p className="tabular text-xs text-muted">{person.phone ? displayPhone(person.phone) : ""}</p>
          </div>
          <div className="max-h-[32rem] space-y-3 overflow-y-auto px-3 py-4">
            {texts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No texts yet.</p>
            ) : (
              texts.map((message) => (
                <div key={message.id}>
                  <p className="tabular mb-1 text-center text-[0.7rem] text-muted">{formatDateTime(message.createdAt, "Pacific/Auckland")}</p>
                  <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-tint px-3.5 py-2.5 text-[0.95rem] leading-snug text-ink">{withLinks(message.body ?? "", site)}</p>
                </div>
              ))
            )}
          </div>
          {person.role === "tradie" && (
            <div className="rounded-b-[1.5rem] border-t border-line px-3 py-3">
              <p className="mb-2 text-center text-xs text-muted">Or answer by text, where replies are switched on:</p>
              <div className="flex justify-center gap-2">
                {["YES", "NO"].map((reply) => (
                  <form key={reply} action={sendDemoReply}>
                    <input type="hidden" name="who" value={person.key} />
                    <input type="hidden" name="reply" value={reply} />
                    <SubmitButton variant="small" pendingLabel="Sending...">
                      Reply {reply}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
