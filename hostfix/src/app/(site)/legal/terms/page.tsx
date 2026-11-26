import type { Metadata } from "next";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { LegalPage, Section } from "@/components/LegalPage";
import { FAR_METRES, PROPOSAL_DAYS, WINDOW_HOURS } from "@/lib/jobs/arrival";
import { partsWords } from "@/lib/markets/display";
import { formatMoney } from "@/lib/money";
import { DEPOSIT_ABOVE_CENTS, DEPOSIT_BPS, PART_FEE_BPS } from "@/lib/jobs/pricing";
import { FLAG_DAYS, TRUSTED_FINISHED_JOBS } from "@/lib/tradies/reliability";
import { formatHourOfDay, TEXTING_ENDS, TEXTING_STARTS } from "@/lib/time";

/**
 * THE OWNER TERMS. Plain English, written from what the software actually
 * does (docs/LEGAL-TODO.md, section 2) under the free-to-join model
 * (DECISIONS.md, 2026-11-17). Change this page whenever a promise changes.
 */
export const metadata: Metadata = {
  title: "Terms of service",
  description: `How ${brand.name} works for property owners: free to join, fixed prices, charged when a job is done.`,
};

const UPDATED = "24 November 2026";

/**
 * The hours in section 4 come from the launch market's settings (config/markets.ts), so the page cannot say
 * a number the app does not use. If an admin changes them for a market, change this page too
 * (tests/unit/legal.test.ts checks the page against the market's defaults).
 */
const notTaken = launchMarket.unacceptedAlertHours;
const answerHours = launchMarket.counterOfferHours;
const emergencyWithin = launchMarket.emergencyResponseMinutes === 60 ? "1 hour" : `${launchMarket.emergencyResponseMinutes} minutes`;
const quiet = `${formatHourOfDay(TEXTING_ENDS)} and ${formatHourOfDay(TEXTING_STARTS)}`;
// The checks on every finished job (DECISIONS.md, 2026-11-19), from the same settings and constants the app uses.
const minMinutes = launchMarket.minMinutesOnSite;
const confirmHours = launchMarket.ownerConfirmHours;
const money = (cents: number) => formatMoney(cents, launchMarket.currency);

export default function Page() {
  const n = brand.name;
  return (
    <LegalPage
      title="Terms of service"
      updated={UPDATED}
      intro={`These are the terms for owners and managers who use ${n} to look after their properties. Joining is free. You pay the fixed price when a job is done. Here is exactly how that works.`}
    >
      <Section n={1} title="What we do">
        <p>
          {n} arranges maintenance at your property: cleaning, gardens, windows and carpets as well as repairs, plumbing, electrical and building
          work. You, your cleaner or your guest reports a problem or books a job. We offer it to a local tradie we have checked, who comes and does it.
          Building work is only offered to a Licensed Building Practitioner, and plumbing, gas, electrical and drainlaying work only to someone whose
          licence is on file and in date. When the job is sent out we hold its price on your saved card. You&rsquo;re only charged once it&rsquo;s fixed. We are the business you deal with:
          you pay us, we pay the tradie, and you can raise any problem with us.
        </p>
      </Section>

      <Section n={2} title="Joining and your card">
        <p>
          There is no joining fee and no monthly fee. To cover a property you add it to the app and put a card on file with Stripe, our payment
          company. We never see your card number. Nothing is charged until a job is done at your property. When a job is sent out, its price is held on your
          card: a hold is not a charge, and it is let go if the job does not go ahead. For work that takes a job over {money(DEPOSIT_ABOVE_CENTS)} you can also add a
          New Zealand bank account, once, on Stripe&rsquo;s page, where you agree to the direct debit (section 6).
        </p>
      </Section>

      <Section n={3} title="Prices">
        <ul>
          <li>
            <strong>Menu jobs have a fixed price</strong>, shown before anyone is sent, including GST and the call-out. The price you see when you
            log the job is the price you pay, even if we change the menu later.
          </li>
          <li>
            <strong>How soon.</strong> You choose when you log the job. <strong>Standard</strong>: on site within 24 hours, no extra.{" "}
            <strong>Urgent</strong>: on site within 4 hours (the tradie drops what they are doing), {money(launchMarket.urgentSurchargeCents)} more.{" "}
            <strong>Emergency</strong>: on site within {emergencyWithin}, {money(launchMarket.emergencySurchargeCents)} more; it goes to every
            tradie who is working at that moment, at once. An urgent or emergency job asked for before 7am, after 4:30pm or at the weekend also
            carries the after-hours call-out ({money(launchMarket.afterHoursSurchargeCents)}), on top. Each amount is shown before you choose it,
            and like the rest of the price it is fixed: nothing is added on the day. You pay each surcharge only for what actually happened
            (section 4). Urgent and emergency are only offered when at least one tradie who could take the job is working right now; if nobody
            is, the form says when the first one starts, and a standard job is sent to them then. No membership includes emergency.
          </li>
          <li>
            <strong>Jobs not on the menu</strong> cost a fixed call-out for a tradie to come and look, then a quote. You choose the trade, or
            &ldquo;Not sure&rdquo;: then our team reads what you wrote and chooses the trade before it is offered to anyone. Any quote over NZ$600, or over
            the limit you set for that property, stops until you say yes. When a quote goes ahead (your yes, or inside your limit), the call-out comes off
            it, so you pay for the visit once. If you say no, the call-out is still charged. For plumbing, electrical, gas and handyman work, extra work up to NZ$1,000 is quoted in
            hours at a fixed hourly rate for the trade, which the tradie cannot change; bigger work the tradie prices. Every other trade (cleaning,
            gardening and the rest) prices extra work as one amount, and it only starts once you have said yes or it is inside your limit. A return visit is part of the quote, never a second call-out.
          </li>
          <li>
            <strong>How {n} is paid.</strong> Our fee comes out of the price, never on top of it: {launchMarket.platformFeeBps / 100}% of the first{" "}
            {money(launchMarket.tierThresholdCents)} of a job&rsquo;s price and {launchMarket.aboveTierFeeBps / 100}% of the part above it, and{" "}
            {PART_FEE_BPS / 100}% of parts. The tradie gets the rest.
          </li>
          <li>
            <strong>Not the job described.</strong> On a menu job, a quote is only for work beyond the job you described, which is still done at its
            price. If the tradie finds it is not the job described at all, they tell us with photos and a reason, and quote. The menu price comes off
            and the call-out is charged instead, once you approve the quote or if you have not pressed &ldquo;This was the job I described&rdquo;
            within 24 hours. If you press it, we decide from the photos whether the call-out is charged.
          </li>
          <li>
            <strong>Parts.</strong> {partsWords(launchMarket)} The tradie can add parts on any job. Up to {money(launchMarket.partsApprovalCents)} of parts on a job
            (and within the limit for that property) they are added straight away and we text you; above that, nothing is bought until you say yes on the job
            page. Our team can ask the tradie for the receipt for any part, and checks it. If you supply a part yourself there is no parts charge, but a fault in a part you
            supplied is not covered by the tradie&rsquo;s 30-day callback. If a job is cancelled after you approved work, parts already bought for it that cannot
            be returned are charged at what they cost, with nothing added. A faulty part is replaced under its maker&rsquo;s warranty, which the tradie deals
            with; the labour is covered by the 30-day callback below.
          </li>
        </ul>
      </Section>

      <Section n={4} title="Our promise, and what happens if we miss it">
        <p>
          We aim to have a tradie on site within 24 hours of a job being sent out, within 4 hours for an urgent job, or within {emergencyWithin}{" "}
          for an emergency, counting nights and weekends. &ldquo;On site&rdquo; is the tradie&rsquo;s own tap of &ldquo;I have arrived&rdquo; at your door. You only ever pay for what was
          actually delivered:
        </p>
        <ul>
          <li>
            <strong>A normal job.</strong> When a tradie accepts, they choose a {WINDOW_HOURS}-hour window to arrive in, inside the 24 hours. We text
            you that window, and it is on the job page.
          </li>
          <li>
            <strong>Nobody has taken it after {notTaken} hours.</strong> We text you, and our team rings round for a tradie. You pay nothing unless
            a tradie does the job. On a normal job those {notTaken} hours count only the time between {formatHourOfDay(TEXTING_STARTS)} and{" "}
            {formatHourOfDay(TEXTING_ENDS)}, and we do not text you about it between {quiet}: the text waits until {formatHourOfDay(TEXTING_STARTS)}.
          </li>
          <li>
            <strong>An urgent job reached late.</strong> If the tradie taps &ldquo;I have arrived&rdquo; after the 4-hour deadline, the urgent surcharge is
            not charged. The rest of the job is charged as normal.
          </li>
          <li>
            <strong>An emergency reached late.</strong> If the tradie taps &ldquo;I have arrived&rdquo; more than {emergencyWithin} after the job was
            sent out, the {money(launchMarket.emergencySurchargeCents)} emergency surcharge is not charged. The rest of the job is charged as normal.
          </li>
          <li>
            <strong>Nobody free within the hour.</strong> If no tradie has taken an emergency {launchMarket.emergencyStepDownMinutes} minutes after
            it was sent out, we text you a link. On the job page one button switches it to urgent (within 4 hours from then) for{" "}
            {money(launchMarket.emergencySurchargeCents - launchMarket.urgentSurchargeCents)} less: the urgent surcharge replaces the emergency one.
            If you do nothing, we keep looking for someone within the hour and our team rings round.
          </li>
          <li>
            <strong>After hours.</strong> The after-hours surcharge is charged only if the tradie arrives before 7am, after 4:30pm or at the weekend.
            If they come within working hours, it is not charged. It is separate from the urgent or emergency surcharge: at 9pm an emergency
            carries both, and each is charged only if its own rule is met.
          </li>
          <li>
            <strong>Tradies&rsquo; own hours.</strong> Each tradie tells us the hours and days they want jobs. A job is only offered to tradies who
            are inside their hours at that moment. A standard job logged when nobody is working waits, and goes out when the first tradie&rsquo;s
            hours begin.
          </li>
          <li>
            <strong>Your usual tradie can&rsquo;t make it in time.</strong> Our first-choice or backup tradie may suggest a later time instead, up to{" "}
            {PROPOSAL_DAYS} days ahead. We text you, and you choose on the job page: wait for them, or have it sent to another {n} tradie now. If you
            have not answered within {answerHours} hours we send it on. On a normal job we do not send that text between {quiet}, and the {answerHours}{" "}
            hours count only the time between {formatHourOfDay(TEXTING_STARTS)} and {formatHourOfDay(TEXTING_ENDS)}; on an urgent job they run at any
            time. If you wait, that later time becomes the promise, and an urgent job stops being urgent, so the urgent surcharge is not charged.
            (An emergency goes to everyone at once, so this does not happen on an emergency.)
          </li>
          <li>
            <strong>The tradie isn&rsquo;t there.</strong> If the app says the tradie has arrived and nobody is there, press &ldquo;The tradie isn&rsquo;t
            here&rdquo; on the job page and our team rings them straight away.
          </li>
        </ul>
        <p>
          You see the final price on the job page before your card is charged. We do not give a credit or a discount when a tradie is late or does
          not turn up; we chase the tradie and get someone there. A credit for a missed time given before 18 November 2026 still comes off that
          job&rsquo;s charge.
        </p>
      </Section>

      <Section n={5} title="Who can send a tradie at your cost">
        <ul>
          <li>You, from the app.</li>
          <li>
            <strong>People on your team</strong>: the cleaners and co-hosts you add by name and mobile, for the properties you tick for them. Each has
            their own link, which only opens on a phone that has typed a code we text to their mobile. For each person you choose whether a tradie is
            sent straight away at your cost or you are asked first. Every report is signed with their name, and taking them off your team stops it at once.
          </li>
          <li>
            <strong>Anyone holding a property&rsquo;s older team link</strong>, if you shared one before teams existed. A report from that link sends a
            tradie straight away at your cost, so only give it to people you trust, and replace it on the property page if it leaks.
          </li>
          <li>
            <strong>Your guests</strong>, from the QR card in the house. A guest&rsquo;s report waits for your yes before anyone is sent, unless you switch
            that off for a property. Guests never see prices.
          </li>
          <li>Our team, if you phone us and ask.</li>
        </ul>
        <p>
          When you, a manager or someone on your team logs a job, we ask whether a guest is staying at the time. If yes, or not sure, you can give
          the guest&rsquo;s first name and mobile: we text them when the tradie is coming (&ldquo;They&rsquo;ll knock first&rdquo;) and again when the
          tradie is on the way, and use that number for nothing else. A guest who reports a problem from the QR card gets the same texts. You also
          choose whether the tradie may let themselves in if nobody answers: yes unless a guest is staying or you are not sure. With a guest there,
          the tradie knocks and waits, and only lets themselves in if nobody answers after 5 minutes and you said that&rsquo;s OK.
        </p>
      </Section>

      <Section n={6} title="Access to your property">
        <p>
          Each property has a pin on a map, which you check on the property page: we look the address up, and you can move the pin onto
          the house. It is how we check a tradie is really at your property.
        </p>
        <p>
          You give us the access notes a tradie needs. They are shown only to the tradie who accepted the job, and only after accepting. We
          recommend a lockbox or smart lock with a code you can change. You are responsible for the notes being right.{" "}
          <strong>If the tradie can&rsquo;t get in, the call-out is charged</strong>: the tradie is paid it, and that is charged to you. Changing a door
          or lockbox code after a job is your responsibility; the property page reminds you after a job.
        </p>
        <p>
          Tell us the hazards you know of at each property in &ldquo;Anything a tradie should know to stay safe?&rdquo; on the property page: roof
          access, asbestos in an older home, a steep drive, a dog, a fragile deck. Under the Health and Safety at Work Act you and the tradie share
          a duty to keep the work safe. We show what you write to a tradie before they accept and on their job screen. A tradie who finds a hazard
          adds it to the property, and we text you.
        </p>
      </Section>

      <Section n={7} title="Charging your card">
        <p>
          Before a job is sent to tradies, we check you have a usable saved card: one on file, not expired, and no earlier charge unpaid. If not,
          we ask you to update it on the Billing page before you log a job, and a job your team or our team logs waits until you do, with our
          team told (a guest&rsquo;s report waits for your yes, as always).
        </p>
        <p>
          <strong>A hold on your card.</strong> When a job is sent out, we hold the price you saw on your card: the menu price with GST and any urgent,
          emergency or after-hours charge, or for a job not on the menu the {money(launchMarket.diagnosisFeeCents)} call-out. A hold is not a charge. If your card declines
          the hold, the job is not sent, and we ask you to update your card. A card lets go of a hold after a few days, so for a job that is still open we
          place a fresh hold before the old one runs out, and let the old one go. For a visit booked further ahead, the hold is placed a day before it.
        </p>
        <p>
          <strong>You&rsquo;re only charged once it&rsquo;s fixed.</strong> When the tradie finishes, with a photo and a note, the job&rsquo;s price is taken
          from the hold. Anything approved beyond it (parts, more work) is charged then, separately, to the same card. There is no approval step at that point,
          because you approved the price when the job was logged and anything more as it came up. If a charge fails we try again, a day apart, four times, and
          then a person contacts you. The tradie is paid at the usual time either way, so
          a charge that still fails is an amount you owe us. You cannot send new jobs until it is paid. A new card on the Billing page is tried straight away.
        </p>
        <p>
          <strong>Work that takes a job over {money(DEPOSIT_ABOVE_CENTS)}</strong> always waits for your yes, even inside your limit. When you approve it,{" "}
          {DEPOSIT_BPS / 100}% of the approved amount (less any of it the hold on your card already covers) is taken as a deposit, and the tradie does not start until
          it has cleared. The other {DEPOSIT_BPS / 100}% is taken, the same way, when the tradie taps Job done, with the rest of the job. You choose how on the job
          page: <strong>from your bank account by direct debit</strong> (what we recommend: no card fees), which usually takes 3-4 working days to clear, and Stripe
          emails you before each debit; or <strong>by card</strong>, charged straight away, so urgent work can start as soon as the deposit goes through. If the deposit
          does not go through, or comes back, the work is not approved and the tradie does not start; you can approve it again, by bank or card. If the debit at Job
          done does not go through, it is an amount you owe us, and you cannot send new jobs until it is paid: we charge your card once you update it on the Billing
          page. If the work does not go ahead after a deposit, the deposit is refunded.
        </p>
        <p>
          <strong>Cancelling.</strong> You can cancel a job on its page. Until the tradie taps &ldquo;I have arrived&rdquo;, even when they are on the way, it
          is free: the hold is let go and you pay nothing. After they have arrived, cancelling charges the call-out (never more than the job would have cost,
          plus any urgent or after-hours charge) instead of the job, taken from the hold.
        </p>
        <p>
          <strong>Invoices.</strong> The tradie does the work for you; we arrange it and collect your payment for them. For each job you get an invoice
          in the app, issued by us on the tradie&rsquo;s behalf in their name. If the tradie is registered for GST it is a tax invoice showing their GST
          number and the GST in the price; if not, there is no GST in it. The price is the same either way. One statement a month in the app also shows
          every job, charge and credit.
        </p>
      </Section>

      <Section n={8} title="If something is wrong with the work">
        <p>
          <strong>Every job is checked.</strong> The tradie takes a before photo when they tap &ldquo;I have arrived&rdquo; and an after photo when
          they finish, in the app. Their phone&rsquo;s location at both taps is compared with your property&rsquo;s pin. If either tap has no location
          or is more than {FAR_METRES} m away, or the job is finished less than {minMinutes} minutes after the tradie arrived (except a diagnosis or a visit
          to look and price, or when they could not get in), the job is flagged. Your card is charged as normal, but the tradie&rsquo;s payment may be held
          while we ask you to look at the before and after photos on the job page and press &ldquo;Yes, it&rsquo;s fixed&rdquo; or &ldquo;Something&rsquo;s
          wrong&rdquo;. If you have not answered within {confirmHours} hours, a tradie with {TRUSTED_FINISHED_JOBS} or more finished jobs and no other flagged
          job in the last {FLAG_DAYS} days is paid; for anyone else, our team looks at the photos and decides.
        </p>
        <p>
          Raise it from the job page. If you do so within a day of the job, the tradie&rsquo;s payment is held. We decide from the photos, times and
          locations the app recorded, the notes and both sides, within 5 working days: the work stands, a part refund, or a full refund to your card.
          Owners who misuse &ldquo;Something&rsquo;s wrong&rdquo; (for example on work that was plainly done) can lose access to {brand.name}. If work fails within 30 days
          because of the tradie&rsquo;s workmanship, the tradie comes back at no charge. Your rights under the Consumer Guarantees Act are not affected
          by any of this.
        </p>
      </Section>

      <Section n={9} title="Leaving">
        <p>
          You can remove a property or close your account at any time from the app. There is nothing to cancel and nothing to refund, because
          nothing is charged except jobs a tradie has come out for (section 7). Jobs already under way are finished and charged under these terms.
        </p>
      </Section>

      <Section n={10} title="What we are not">
        <p>
          We are not an insurer and not an emergency service. If there is danger (fire, gas, sparks, anyone hurt), call 111 first. If a tradie
          damages something, the claim goes to the tradie&rsquo;s public liability insurer (every tradie has it before we approve them); we supply the
          job&rsquo;s photos and times. We arrange
          repairs; we do not guarantee that a problem can be fixed on the first visit, or that parts are available the same day. We are not
          responsible for loss of bookings or reviews caused by a fault at your property.
        </p>
      </Section>

      <Section n={11} title="Changes and the law">
        <p>
          Menu prices can change; the price you see when you log a job is the one you pay. If these terms change in a way that matters, we email
          you 14 days before. New Zealand law applies, and disputes we cannot settle between us go to the Disputes Tribunal or the New Zealand
          courts.
        </p>
      </Section>
    </LegalPage>
  );
}
