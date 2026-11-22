import { inviteMyClient, inviteMyTradie } from "@/app/actions/clients";
import { ActionForm, Field, Select } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { trades } from "@config/trades";
import type { Invite, Pair } from "@/lib/clients/own-clients";
import { OWN_CLIENT_FEE_BPS } from "@/lib/jobs/pricing";
import { formatDate } from "@/lib/time";

/**
 * OWN CLIENTS ON SCREEN (DECISIONS.md, 2026-11-23): the tradie's invites and
 * their own clients, and an owner's "Bring your own tradie" on a property.
 */

const fee = `${OWN_CLIENT_FEE_BPS / 100}%`;

/** On the tradie's profile: invite a client, and the properties already paired with them. */
export function TradieOwnClients({ pairs, invites, timeZone, marketFeePct }: { pairs: (Pair & { propertyName: string; suburb: string; ownerName: string })[]; invites: Invite[]; timeZone: string; marketFeePct: string }) {
  return (
    <Card className="sm:p-6" as="section">
      <SectionTitle>Your own clients</SectionTitle>
      <p className="text-muted">
        Bring owners you already work for. Once they join and pick their property, your jobs there are {fee}, not {marketFeePct}: that covers the card fees (about 3%), the
        automatic texts and payment, and chasing late payers. You are their first choice there. A property where we have already sent you a job stays at {marketFeePct}.
      </p>
      {pairs.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {pairs.map((pair) => (
            <li key={pair.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>
                {pair.propertyName}
                <span className="block text-sm text-muted">{[pair.ownerName, pair.suburb].filter(Boolean).join(", ")}</span>
              </span>
              <Chip tone="done">{fee}</Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Reveal label="Invite a client">
          <ActionForm action={inviteMyClient} className="space-y-3">
            <Field label="Their name" name="clientName" required maxLength={80} />
            <Field label="Their mobile" name="clientPhone" type="tel" inputMode="tel" maxLength={30} hint="We text them the link. Or give an email address instead." />
            <Field label="Or their email" name="clientEmail" type="email" inputMode="email" maxLength={254} />
            <SubmitButton variant="secondary" pendingLabel="Sending...">
              Send the invite
            </SubmitButton>
          </ActionForm>
        </Reveal>
      </div>
      {invites.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {invites.map((invite) => (
            <li key={invite.id}>
              {invite.name}, sent {formatDate(invite.createdAt, timeZone)}: {invite.status === "used" ? "joined" : invite.status === "cancelled" ? "cancelled" : "not used yet"}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** On an owner's property page: "Bring your own tradie", and the tradies already paired with it. */
export function BringYourOwnTradie({ propertyId, pairs, invites, timeZone }: { propertyId: string; pairs: (Pair & { businessName: string; trades: string[] })[]; invites: Invite[]; timeZone: string }) {
  const tradeOptions = trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label }));
  return (
    <Card>
      <SectionTitle>Bring your own tradie</SectionTitle>
      <p className="text-muted">
        Already have a plumber or sparky you trust? Invite them. Once they sign up and we approve them (insurance, licence, our agreement), they are the first tradie we offer
        this property&rsquo;s jobs to in their trade, at the same menu prices, booked and paid through the app.
      </p>
      {pairs.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pairs.map((pair) => (
            <li key={pair.id} className="text-ink">
              {pair.businessName} <span className="text-sm text-muted">· your first choice here</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Reveal label="Invite my tradie">
          <ActionForm action={inviteMyTradie} className="space-y-3">
            <input type="hidden" name="propertyId" value={propertyId} />
            <Field label="Their name or business" name="tradieName" required maxLength={80} />
            <Field label="Their mobile" name="tradiePhone" type="tel" inputMode="tel" required maxLength={30} hint="We text them a link to sign up." />
            <Select label="Their trade" name="trade" options={tradeOptions} placeholder="Choose one" />
            <SubmitButton variant="secondary" pendingLabel="Sending...">
              Send the invite
            </SubmitButton>
          </ActionForm>
        </Reveal>
      </div>
      {invites.filter((invite) => invite.status === "open").length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {invites.filter((invite) => invite.status === "open").map((invite) => (
            <li key={invite.id}>{invite.name}: invited {formatDate(invite.createdAt, timeZone)}, not signed up yet</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
