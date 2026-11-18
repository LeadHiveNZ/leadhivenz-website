import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { becomePerson, runTimerNow, skipTime } from "@/app/actions/demo";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice, SectionTitle } from "@/components/ui/Bits";
import { Icon, type IconName } from "@/components/ui/Icon";
import { clockOffsetMs, now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { demoPeople } from "@/lib/demo/state";
import type { DemoPerson } from "@/lib/demo/sample";
import { demoModeAllowed } from "@/lib/env";
import { formatDateTime, formatDuration } from "@/lib/time";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ICONS: Record<DemoPerson["role"], IconName> = { owner: "property", tradie: "tradie", dispatcher: "queue", admin: "chart", cleaner: "phone", guest: "phone" };

/** The way in to the demo: choose who to be, open a phone, or skip the clock ahead. */
export default async function DemoHub({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  if (!demoModeAllowed()) notFound();
  const query = await searchParams;
  const db = await getDb();
  const people = await demoPeople(db);
  const links = await db.query<{ name: string; team_token: string; guest_token: string }>(
    "select name, team_token, guest_token from public.properties where status = 'active' order by created_at limit 1",
  );
  const place = links[0];
  // The sample cleaner's own team link, opened as if it had been forwarded: the code screen, nothing else.
  const cleanerLink = (await db.query<{ link_token: string }>("select link_token from public.team_links order by created_at limit 1"))[0]?.link_token ?? null;
  const offset = clockOffsetMs();
  const group = (role: DemoPerson["role"]) => people.filter((person) => person.role === role);

  const Person = ({ person }: { person: DemoPerson }) => (
    <form action={becomePerson} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
      <input type="hidden" name="who" value={person.key} />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
        <Icon name={ICONS[person.role]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{person.label}</span>
        <span className="block text-sm text-muted">{person.note}</span>
      </span>
      <SubmitButton variant="small" pendingLabel="Opening...">
        Be them
      </SubmitButton>
    </form>
  );

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-bold tracking-wide text-brand uppercase">Demo</p>
        <h1 className="display mt-1 text-4xl text-ink">Try every side of it</h1>
        <p className="mt-2 text-lg text-muted">
          This is a made-up business with made-up people, so you can press every button. No real texts are sent, no real money moves, and nothing here can reach the live site.
        </p>
      </div>

      {query.skipped && (
        <Notice tone="good" title={`Skipped ahead ${Number(query.skipped) >= 60 ? `${Number(query.skipped) / 60} ${Number(query.skipped) === 60 ? "hour" : "hours"}` : `${String(query.skipped)} minutes`}`}>
          Everything that would have happened in that time has happened: offers ran out and moved on, payments were sent, promises were kept or missed. Look at the queue.
        </Notice>
      )}
      {query.ran && <Notice tone="good" title="The timer ran" />}

      {people.length === 0 ? (
        <Notice tone="warn" title="There is no sample data">
          The app started empty. Delete the .data folder and start it again to get the sample business back.
        </Notice>
      ) : (
        <>
          <section>
            <SectionTitle>1. A good first walk-through</SectionTitle>
            <Card>
              <ol className="list-decimal space-y-2 pl-5 text-ink">
                <li>
                  Open <Link href="/demo/phone?who=dave" className="font-semibold text-brand underline underline-offset-2">Dave the plumber&apos;s phone</Link>. He has a job offer. Tap the link in the text and accept it.
                </li>
                <li>
                  On the job page that opens: tap <strong>I have arrived</strong>, add a photo, and tap <strong>Job done</strong>.
                </li>
                <li>
                  Open <Link href="/demo/phone?who=sam" className="font-semibold text-brand underline underline-offset-2">Sam the owner&apos;s phone</Link> and read the texts he got along the way.
                </li>
                <li>Be <strong>Sam</strong> below. Answer the quote and the guest&apos;s report that are waiting for him, then report a new problem.</li>
                <li>Be <strong>Maria</strong>, the dispatcher. Her queue holds only what the system could not sort out by itself. Deal with each one.</li>
                <li>Skip ahead a day (bottom of this page) and watch the tradies get paid.</li>
              </ol>
            </Card>
          </section>

          <section>
            <SectionTitle>2. Be someone</SectionTitle>
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Owners</p>
                <div className="space-y-2">{group("owner").map((person) => <Person key={person.key} person={person} />)}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Tradies</p>
                <div className="space-y-2">{group("tradie").map((person) => <Person key={person.key} person={person} />)}</div>
              </div>
              {group("cleaner").some((person) => person.userId) && (
                <div>
                  <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Cleaners</p>
                  <div className="space-y-2">{group("cleaner").filter((person) => person.userId).map((person) => <Person key={person.key} person={person} />)}</div>
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Your team</p>
                <div className="space-y-2">{[...group("dispatcher"), ...group("admin")].map((person) => <Person key={person.key} person={person} />)}</div>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>3. No account needed</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/demo/phone" className="rounded-2xl border border-line bg-surface p-4 hover:border-brand/40">
                <span className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="phone" className="text-brand" /> Open someone&apos;s phone
                </span>
                <span className="mt-1 block text-sm text-muted">See the texts each person was sent, with the links that work without signing in.</span>
              </Link>
              {place && (
                <>
                  <Link href={`/r/${place.guest_token}`} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand/40">
                    <span className="flex items-center gap-2 font-bold text-ink">
                      <Icon name="door" className="text-brand" /> Scan the QR card as a guest
                    </span>
                    <span className="mt-1 block text-sm text-muted">What a guest at {place.name} sees. The owner is asked before anyone is sent.</span>
                  </Link>
                  <Link href={`/r/${place.team_token}`} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand/40">
                    <span className="flex items-center gap-2 font-bold text-ink">
                      <Icon name="plus" className="text-brand" /> The older per-property link
                    </span>
                    <span className="mt-1 block text-sm text-muted">Still works for anyone who has it. A tradie is sent straight away, signed with whatever name is typed.</span>
                  </Link>
                  {cleanerLink && (
                    <Link href={`/r/${cleanerLink}`} className="rounded-2xl border border-line bg-surface p-4 hover:border-brand/40">
                      <span className="flex items-center gap-2 font-bold text-ink">
                        <Icon name="phone" className="text-brand" /> Mele&apos;s link, forwarded
                      </span>
                      <span className="mt-1 block text-sm text-muted">On a phone that has not proved her number it opens only the code screen. Be Mele above to skip it.</span>
                    </Link>
                  )}
                </>
              )}
              <Link href="/" className="rounded-2xl border border-line bg-surface p-4 hover:border-brand/40">
                <span className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="home" className="text-brand" /> The public site
                </span>
                <span className="mt-1 block text-sm text-muted">The pages your ads point to. Join as a new owner from there.</span>
              </Link>
            </div>
          </section>
        </>
      )}

      <section>
        <SectionTitle>4. Skip ahead in time</SectionTitle>
        <Card>
          <p className="text-muted">
            An offer is held for 15 minutes before it moves to the next tradie, and a tradie&apos;s payment is sent a day after a job. Rather than wait, move the demo&apos;s clock forward.{" "}
            <span className="text-ink">
              The demo thinks it is {formatDateTime(now(), "Pacific/Auckland")} in Queenstown{offset > 0 ? `, ${formatDuration(offset)} ahead of the real time` : ""}.
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              [15, "15 minutes"],
              [60, "1 hour"],
              [240, "4 hours"],
              [1440, "1 day"],
            ].map(([minutes, label]) => (
              <form key={minutes} action={skipTime}>
                <input type="hidden" name="minutes" value={minutes} />
                <SubmitButton variant="secondary" pendingLabel="Skipping...">
                  Skip {label}
                </SubmitButton>
              </form>
            ))}
            <form action={runTimerNow}>
              <SubmitButton variant="small" pendingLabel="Running...">
                Run the timer now
              </SubmitButton>
            </form>
          </div>
          <p className="mt-3 text-sm text-muted">The clock only goes forward. To start again from the beginning, stop the app, delete the .data folder, and start it again.</p>
        </Card>
      </section>
    </div>
  );
}
