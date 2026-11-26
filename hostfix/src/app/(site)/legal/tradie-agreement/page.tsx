import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";
import { launchMarket } from "@config/markets";
import { OLD_RECEIPT_DAYS, PART_PRICE_FLAG_MULTIPLE, RECEIPT_TO_FOLLOW_DAYS } from "@/lib/jobs/parts";
import { DEPOSIT_ABOVE_CENTS, DEPOSIT_BPS, OWN_CLIENT_FEE_BPS, PART_FEE_BPS, tieredFee } from "@/lib/jobs/pricing";
import { PATTERN_DAYS, PATTERN_PAIR_JOBS, PATTERN_TRADIE_CANCELS } from "@/lib/ops/patterns";
import { formatMoney } from "@/lib/money";
import { FEE_NOTICE_DAYS } from "@/lib/markets/admin";
import { TRADIE_AGREEMENT_VERSION } from "@/lib/tradies/service";
import { DEFAULT_HOURLY_RATES, HOURLY_LIMIT_CENTS } from "@/lib/jobs/rates";
import { findTrade } from "@config/trades";
import { FAR_METRES, PROPOSAL_DAYS, WINDOW_HOURS } from "@/lib/jobs/arrival";
import {
  FLAG_DAYS, FLAG_REVIEW, MIN_ARRIVALS, NO_SHOW_DAYS, NO_SHOW_REVIEW, ON_TIME_TARGET, RECENT_ARRIVALS, TRUSTED_FINISHED_JOBS,
} from "@/lib/tradies/reliability";

/**
 * THE TRADIE AGREEMENT. One page, plain English, written from what the
 * software actually does (docs/LEGAL-TODO.md, section 3). A tradie agrees to
 * it in the app before they can be approved, and the time is recorded.
 */
export const metadata: Metadata = {
  title: "Tradie agreement",
  description: `How working with ${brand.name} works: the offers, the prices, the pay, and what we expect from each other.`,
};

// The version a tradie agrees to in the app. Changing it asks every tradie to agree again before their next offer.
const UPDATED = TRADIE_AGREEMENT_VERSION;

export default function Page() {
  const n = brand.name;
  const money = (cents: number) => formatMoney(cents, launchMarket.currency);
  // The trades with a fixed hourly rate (DECISIONS.md, 2026-11-24, second entry), from the code, so the page cannot drift.
  const ratedTrades = Object.keys(DEFAULT_HOURLY_RATES).map((key) => (findTrade(key)?.label ?? key).toLowerCase());
  const rated = `${ratedTrades.slice(0, -1).join(", ")} and ${ratedTrades.at(-1)}`;
  const fee = `${launchMarket.platformFeeBps / 100}%`;
  const ownFee = `${OWN_CLIENT_FEE_BPS / 100}%`;
  const emergencyWithin = launchMarket.emergencyResponseMinutes === 60 ? "1 hour" : `${launchMarket.emergencyResponseMinutes} minutes`;
  const emergencyShare = money(launchMarket.emergencySurchargeCents - Math.round((launchMarket.emergencySurchargeCents * launchMarket.platformFeeBps) / 10_000));
  const guarantee = money(launchMarket.payoutGuaranteeCents);
  // The tiered fee (DECISIONS.md, 2026-11-23, second entry): the fee on the first NZ$1,000 of a job's price, 3% above it.
  const line = money(launchMarket.tierThresholdCents);
  const aboveFee = `${launchMarket.aboveTierFeeBps / 100}%`;
  const exampleCents = 1_500_000;
  const exampleFee = tieredFee(exampleCents, launchMarket.platformFeeBps, { thresholdCents: launchMarket.tierThresholdCents, aboveBps: launchMarket.aboveTierFeeBps });
  const big = money(DEPOSIT_ABOVE_CENTS);
  const half = `${DEPOSIT_BPS / 100}%`;
  return (
    <LegalPage
      title="Tradie agreement"
      updated={UPDATED}
      intro={`This is the deal between you and ${n}. It is short on purpose. You agree to it once in the app, and we record when you did. If anything here is unclear, ask us before you accept your first job.`}
    >
      <Section n={1} title="What this is">
        <p>
          {n} sends you fixed-price jobs at holiday homes by text. You choose which to take. You are an independent contractor running your own
          business: you use your own tools and vehicle, you work for whoever else you like, and you are responsible for your own tax, ACC levies
          and insurance. You are not our employee.
        </p>
        <p>
          <strong>The work is yours; we arrange it and collect the money for you.</strong> When you do a job, you are the one supplying the work to the
          owner. {n} finds the job, sets the fixed price and collects the owner&rsquo;s payment as your agent, then pays you your share less the platform fee
          (section 6). You can always say no to a job.
        </p>
      </Section>

      <Section n={2} title="What you need before your first job">
        <ul>
          <li>
            <strong>Public liability insurance of at least NZ$1 million</strong> in your own name (or your business&rsquo;s), with the insurer, policy number and expiry date entered in your profile,
            and the certificate of currency from your insurer uploaded there (a PDF, JPG or PNG). Only our team and you can open the certificate.
            When you renew, upload the new one: we keep the earlier ones as a record. We do not approve anyone, or offer them jobs, without
            current insurance and its certificate on file, and the app stops offering you jobs the day it expires.
          </li>
          <li>
            <strong>Current licences</strong> for any plumbing, gas, electrical or drainlaying work, with the number and expiry in your profile.
            Licensed work is only ever offered to someone whose licence is on file and in date. We check each one against the public register.
          </li>
          <li>
            <strong>Your criminal record</strong>, because you will be entering homes that may have guests in them. You request your own copy
            from the Ministry of Justice (it is free, and can take up to 20 working days, so ask for it early) and send it to us before your first job.
            We treat it as confidential and keep only a note that we have seen it.
          </li>
          <li><strong>Bank details with Stripe</strong>, set up from your profile, so we can pay you.</li>
          <li>
            <strong>A Licensed Building Practitioner (LBP) number</strong>, if you want building jobs. Building jobs are only offered to, and can
            only be accepted by, a tradie with an LBP number in their profile. Other trades do not need one.
          </li>
        </ul>
        <p>
          You can sign in to your own account as soon as you have applied, to fill these in. Only our team can approve you, and nothing is
          offered to you until we do. We text you when you are approved.
        </p>
        <p>
          <strong>Our checks, and the record we keep.</strong> A person on our team checks every tradie before approving them: each licence and LBP number
          against the public register, your insurance certificate, and your criminal record. We keep a record of each check (what was checked, when, and by
          whom), your licence and insurance details and certificates, and your job history (for the record check, only the note that we saw it), for as long as you work with {n} and as long after as the law needs. You agree to these checks and
          records, and to us showing owners your name, business name and mobile number on jobs you accept. Our privacy policy has the detail.
        </p>
        <p>Tell us within 7 days if any of these change or lapse.</p>
      </Section>

      <Section n={3} title="How offers work">
        <p>
          A job is offered by text to one tradie at a time. The first choice has <strong>15 minutes</strong> to accept, then it moves to the backup,
          then to everyone who does that trade. A job is only offered in the trade it is for: when an owner is not sure which trade a job needs,
          our team reads it and chooses the trade first. Open the link and press a button to accept; opening the link alone does nothing. On a normal job
          you accept by choosing the {WINDOW_HOURS}-hour window you will arrive in, inside the 24 hours; the owner is told that window. Pass whenever you
          cannot do it.
        </p>
        <p>
          <strong>An emergency</strong> (the owner needs someone on site within {emergencyWithin}) is offered to every tradie in the trade who is
          inside their hours, all at once, first choice and backup included. The first to accept has it.
        </p>
        <p>
          <strong>Your hours.</strong> You tell us the days and the hours you want jobs (&ldquo;send me jobs from 7am to 4:30pm&rdquo;) on your
          profile, and change them whenever you like. We only offer you jobs, and only text or notify you about offers, inside those hours on
          those days. That goes for standard, urgent and emergency jobs alike; there is nothing extra to opt in to.
        </p>
        <p>
          <strong>You choose the areas you cover</strong>, on your profile (for example Frankton, Arrowtown or Glenorchy). You start with every area
          ticked; untick the ones you do not want. You are only offered jobs at properties in the areas you have ticked, and at properties whose area
          we have not set yet. <strong>There is no travel charge</strong>: a job pays the same wherever the property is, so only tick the areas you are
          happy to go to at that price. Our team may ring you about a job outside your areas; you can say no, and that is not counted against you.
        </p>
        <p>
          <strong>Declining a job never leads to removal or to fewer offers.</strong> Passing, or letting an offer run out, is not counted against
          you anywhere. You run your own business and choose your own work.
        </p>
        <p>
          If you are the first choice or backup for your trade and cannot make the promised time, you can suggest a later time instead, up to {PROPOSAL_DAYS} days
          ahead. The owner chooses whether to wait for you or have it sent to another tradie. If they wait, the job is yours at that time (and an
          urgent job is no longer urgent, so there is no urgent share). If they do not, we tell you, and that is not counted against you either.
        </p>
        <p>
          Before you accept you see the job, the suburb, what it pays, the time you must be on site by, whether a guest is staying, and any
          hazards the owner or an earlier tradie has noted for the property. <strong>After</strong> you accept you see the address, the access
          notes and the owner&rsquo;s number.
        </p>
      </Section>

      <Section n={4} title="What accepting commits you to">
        <ul>
          <li>Being on site by the end of the window you chose for a normal job, or by the deadline for an urgent one (within 4 hours) or an emergency (within {emergencyWithin}).</li>
          <li>
            Taking at least one <strong>before</strong> photo in the app and tapping <strong>I have arrived</strong> at the door, with your phone&rsquo;s
            location on. That tap is how we measure the time, and it decides whether the urgent, emergency and after-hours shares are paid. The owner can tell us if
            you are not there.
          </li>
          <li>Doing the job described, to a tradesperson&rsquo;s standard, and tidying up after yourself.</li>
          <li>
            Taking at least one <strong>after</strong> photo of the finished work in the app, writing what you did, and tapping <strong>Job done</strong> at
            the property, with your location on. The app will not let you arrive without a before photo or finish without an after photo.
          </li>
          <li>
            <strong>Certificates.</strong> When the law needs one for the work (for example a Certificate of Compliance or Electrical Safety
            Certificate for electrical work, or a gas certificate), adding it to the job in the app, as a PDF or a photo, within 60 days of Job done. The
            owner sees and downloads it there.
          </li>
          <li>
            <strong>The checks.</strong> Your location at Arrived and at Job done is compared with the property&rsquo;s map pin. A tap with no location, or more
            than {FAR_METRES} m from the pin, still works (phones get it wrong), but the job is flagged. So is a job finished less than {launchMarket.minMinutesOnSite} minutes after
            you arrived (a diagnosis, a visit to look and price, and &ldquo;could not get in&rdquo; are never flagged for time), and a photo whose own date is from before the job
            was logged. A flagged job is not an accusation: it only means the owner is asked to confirm it (section 6).
          </li>
          <li>Treating the house, the access code and the owner&rsquo;s details as confidential. Never share a code, and never leave a door unsecured.</li>
          <li>If something you fixed fails within 30 days because of your work, coming back and putting it right at no charge.</li>
        </ul>
      </Section>

      <Section n={5} title="The price is the price">
        <p>
          Every menu job has a fixed price, and your share is shown in the offer before you accept. <strong>By accepting, you accept that
          amount for that job.</strong> You cannot ask the owner for more, charge them directly, or renegotiate on site. There is no travel
          charge, wherever the property is (section 3: you choose your areas).
        </p>
        <p>
          <strong>Extra work on a menu job</strong> is quoted with <strong>Found more to do? Send a quote</strong>. That quote is only for work beyond the
          job described: you still do the job described, at its price. Up to the owner&rsquo;s limit it goes ahead and they are told; above it, nothing
          starts until they say yes. Anything the owner has not approved is at your own cost.
        </p>
        <p>
          <strong>Not the job described.</strong> If what you find is not the job described at all (the dripping tap is a burst pipe in the wall), tap{" "}
          <strong>Not the job described</strong> on a menu job, with at least one photo, a one-line reason and a quote. The menu price comes off and the
          call-out goes on. You are paid the call-out ({money(launchMarket.diagnosisPayoutCents)}) once the owner approves your quote, or if they have not
          objected within {launchMarket.notDescribedHours} hours. If the owner says it was the job they described, our team decides from your photos: call-out
          paid, or no call-out. On a job that was already a look-and-price job, you simply quote.
        </p>
        <p>
          <strong>How quotes are priced.</strong> Work up to {money(HOURLY_LIMIT_CENTS)} is quoted in hours, in quarter hours, at {n}&rsquo;s fixed hourly
          rate for your trade (shown on the quote screen; it is what the owner pays, GST included). You cannot use a different rate. Above{" "}
          {money(HOURLY_LIMIT_CENTS)} you price the work your own way. Only {rated} work has a fixed hourly rate. <strong>Every other trade (cleaning,
          gardening, building and the rest) has none: you quote extra work your own way, as one price for the work including GST, and the owner
          approves it before it starts</strong> (their yes, or inside the limit they set for the property). The platform fee comes off the work, as on every job: {fee} of the first {line} of the
          job&rsquo;s price and {aboveFee} of the part above it ({ownFee} below the line for your own clients, section 10; section 6 has the detail). Parts are added on
          their own, below. <strong>If you need to come back, include the extra visit in your quote.</strong> There is no second call-out on the same job.
        </p>
        <p>
          <strong>Work that takes a job over {big}</strong> always waits for the owner&rsquo;s yes, even inside their limit. When they approve it, {half} of the
          approved amount (less any of it the hold on their card already covers) is taken from them as a deposit, <strong>and you do not start until the deposit
          has cleared.</strong> The owner pays it from their bank account by direct debit (what we recommend: no card fees), which usually takes 3-4 working days
          to clear, or by card, which is charged straight away. We text you &ldquo;approved, deposit clearing&rdquo; and then &ldquo;deposit cleared, go
          ahead&rdquo;; paid by card, you get the approval as soon as it goes through. The other {half} is taken from the owner the same way when you tap Job done. If
          the deposit does not go through, or comes back, the quote is not approved: we text you not to start, and ask the owner to sort it. If the work then does
          not go ahead, the owner is refunded.
        </p>
        <p>
          <strong>The call-out credit.</strong> On a look-and-price job, if the owner approves your quote, the {money(launchMarket.diagnosisFeeCents)} call-out
          comes off the quote for them. It comes off your share in the same proportion: you keep the {money(launchMarket.diagnosisPayoutCents)} call-out pay, plus
          85% of the quote less the call-out. A NZ$500 quote: the owner pays NZ$500 in all, and you get NZ$190 plus 85% of NZ$275 (NZ$233.75),
          NZ$423.75. If the owner says no, the call-out stands and you are paid it.
        </p>
        <p>
          <strong>Parts</strong> can be added on any job, with <strong>Add parts</strong>. Small parts up to {money(launchMarket.partsIncludedCents)} are in the job&rsquo;s price
          (a part, times how many, that comes to that or less is not added). For anything else, enter what it is, how many, and your own price for one, including
          GST: your cost plus your own usual markup. The owner pays that price, and you get it less {PART_FEE_BPS / 100}%, which covers the card fee. No receipt is needed.
          The price list in the app is only a quick way to fill in a name and a price; you can change both. A part you pick from the list and price at more than{" "}
          {PART_PRICE_FLAG_MULTIPLE} times its list price is looked at by our team; nothing is held for that.
        </p>
        <p>
          Up to {money(launchMarket.partsApprovalCents)} of parts on a job (and within the property&rsquo;s overall limit) are added straight away and the owner is told. Above
          that the owner is asked in the app: do not buy them until they say yes. <strong>Keep your receipts.</strong> Our team can ask for the receipt for any part, as a spot
          check: your payment for that job waits for it, and if it has not come within {RECEIPT_TO_FOLLOW_DAYS} days the part is refunded to the owner out of your payment and we
          text you. Only our team sees a receipt. A receipt dated more than {OLD_RECEIPT_DAYS} days before the job, or one already sent for a part on another job, holds your
          payment until our team has looked at it. Parts you added before 23 November 2026 stay on the terms you agreed then.
        </p>
        <p>
          If a part you fitted is faulty, you deal with the supplier&rsquo;s warranty; your labour is covered by the 30-day callback as usual. A part the owner supplied is not yours
          to put right if it fails. If a job is cancelled after the owner approved work, parts you had already bought for it and cannot return are paid at the receipt&rsquo;s cost.
        </p>
      </Section>

      <Section n={6} title="Pay">
        <ul>
          <li>
            <strong>The platform fee is {fee} of the first {line} of a job&rsquo;s price and {aboveFee} of the part above it.</strong> The price is everything
            the owner pays for the job (the menu price or call-out, surcharges, quotes and hourly work) except parts, which have their own {PART_FEE_BPS / 100}%.
            For your own clients it is {ownFee} below the line and {aboveFee} above it (section 10). A {money(exampleCents)} job: {fee} of {line} plus {aboveFee} of{" "}
            {money(exampleCents - launchMarket.tierThresholdCents)} is {money(exampleFee)}, so you get {money(exampleCents - exampleFee)}. Your job page, the offer
            and your Pay page show the fee.
          </li>
          <li>Your share is the amount in the offer. On an urgent, emergency or after-hours job, your share of the surcharge is in that amount, like the rest of the price: the surcharge less the {fee} platform fee ({ownFee} for your own clients). Parts are paid as in section 5: your price less {PART_FEE_BPS / 100}% (parts added before 23 November 2026: the list price less 3%, or what you paid plus 17%).</li>
          <li>
            <strong>The job&rsquo;s price is held on the owner&rsquo;s card when the job is sent out</strong>, and the charge is taken from that hold when you finish. Anything
            approved on top (parts, more work) is charged then too.
          </li>
          <li>
            <strong>If the owner cancels before you tap I have arrived</strong>, even after you tapped On my way, they pay nothing and you are not paid: the travel is yours.
            <strong> If they cancel after you tap I have arrived</strong>, they are charged the call-out and you are paid your share of it, as for a call-out
            ({money(launchMarket.diagnosisPayoutCents)}, plus your share of any urgent, emergency or after-hours surcharge).
          </li>
          <li>
            <strong>The urgent share is paid only if you tap I have arrived by the urgent deadline</strong> shown in the offer. After the deadline the
            urgent surcharge is not charged to the owner at all, so there is no share of it to pay. The rest of the job is paid as normal.
          </li>
          <li>
            <strong>The emergency share ({emergencyShare}) is paid only if you tap I have arrived within {emergencyWithin}</strong> of the job being
            sent out, the deadline shown in the offer. After it, the {money(launchMarket.emergencySurchargeCents)} emergency surcharge is not charged to
            the owner, so there is no share of it to pay. The rest of the job is paid as normal. If nobody takes an emergency in{" "}
            {launchMarket.emergencyStepDownMinutes} minutes the owner may switch it to urgent; it is then offered again as an urgent job.
          </li>
          <li>
            <strong>The after-hours share is paid only if you arrive outside working hours</strong> (before 7am, after 4:30pm, or at the weekend). If you
            come within working hours, the after-hours surcharge is not charged, and the rest of the job is paid as normal. It is paid on top of an
            urgent or emergency share when both rules are met.
          </li>
          <li>
            Your payment is sent 24 hours after the job finishes and reaches your bank about 5 to 6 working days after the job. We will never
            promise you faster than Stripe actually pays.
          </li>
          <li>Your Pay page in the app lists every job and every payment, with the platform fee on each. Statements are there for your accountant.</li>
          <li>
            <strong>Invoices and GST: we do the paperwork.</strong> You agree that {n} issues the owner&rsquo;s invoice for each job on your behalf, in your name,
            and you do not issue your own invoice for it. If you are registered for GST and your GST number is in your profile, it is a tax invoice showing your
            GST number and the GST in the price; if you are not registered, it shows no GST. The prices are the same either way, so tell us within 7 days if you
            register or deregister. You account to Inland Revenue for any GST on your jobs; {n} accounts for its own. The platform fee is our charge to you for
            finding the job, collecting the payment and the paperwork, and it is shown on every job and on your Pay page. {n} is not registered for GST yet,
            so there is no GST in the fee; when that changes we will tell you and update this agreement.
          </li>
          <li>
            <strong>Once you finish a job the owner approved, you&rsquo;re paid even if their card or bank payment fails, for up to {guarantee} of the job&rsquo;s price. Chasing is our job.</strong>{" "}
            Your payment goes out at the usual time whatever the payment does; the owner owes the money to {n}, not to you. On a bigger job, if more than {guarantee} of its
            price has not been paid by the owner when your payment is due (for example the second half of big work, debited from their bank at Job done and not yet
            cleared), your share of the part above {guarantee} waits, and is sent to you as soon as it is paid.
          </li>
          <li>If you could not get in through no fault of yours, tap <strong>Could not get in</strong> with a photo, and you are paid the call-out.</li>
          <li>
            <strong>A flagged job&rsquo;s payment waits for the owner.</strong> They are asked to look at your before and after photos and confirm it is fixed.
            When they do, you are paid as normal. If they say something is wrong, section 7 applies. If they have not answered within {launchMarket.ownerConfirmHours} hours, you
            are paid if you are trusted ({TRUSTED_FINISHED_JOBS} or more finished jobs, and no other flagged job in the last {FLAG_DAYS} days); otherwise our team looks at
            the photos and either pays you or holds the payment while they talk to you and the owner.
          </li>
        </ul>
      </Section>

      <Section n={7} title="If the owner raises a problem, or their bank disputes the charge">
        <p>
          An owner can raise a problem from their job page. If they do within a day of the job, your payment is held until it is sorted. Our
          team looks at the photos, the notes and both sides, then decides: the work stands and you are paid in full, or part or all of the job is
          refunded and your payment is reduced in proportion. If you have already been paid, we take your share of the refund back from that
          payment through Stripe; if that cannot be done, you agree to repay it. We will always tell you why.
        </p>
        <p>
          <strong>Chargebacks and direct-debit disputes.</strong> If the owner&rsquo;s bank disputes the charge for a job, your payment for it is held if it
          has not been sent yet, and we contest the dispute with the job&rsquo;s photos, times, locations, receipts and messages. If we win, you are paid as
          normal. If we lose, our team decides whether it was your fault (bad work or a no-show). If it was, a payment not yet sent for that job is
          cancelled, and a payment already sent becomes a balance you owe us, taken back from your later payments, never more than 50% of any one
          payment; we text you when this happens, and your Pay page shows what is left. If it was not your fault, {n} carries the loss and you are
          paid as normal. Any balance left when you leave {n} must be repaid.
        </p>
      </Section>

      <Section n={8} title="Your record, and who is offered jobs first">
        <p>
          The app keeps one record that matters: <strong>whether you arrive on time to the jobs you accept</strong>. On time means by the end of the
          window you chose, or by the urgent deadline. Passing on offers is never part of it.
        </p>
        <ul>
          <li>
            <strong>Your on-time record on jobs you accept decides who is offered network jobs first.</strong> Once you have arrived at {MIN_ARRIVALS} jobs, if
            fewer than {Math.round(ON_TIME_TARGET * 100)}% of your last {RECENT_ARRIVALS} were on time, you are offered jobs that go to everyone in your trade after the others have had their
            turn. You still get the offers, a little later. Get back to {Math.round(ON_TIME_TARGET * 100)}% and you are back in the first group.
          </li>
          <li>
            Our team chooses the first choice and backup for each trade, looking at the same on-time record over the last 30 days (80% or better).
            They can be swapped, paused or removed on that record.
          </li>
          <li>
            <strong>A no-show</strong> is a job you accepted where you are not on site by the promised time. We will ring you. Repeated no-shows on
            accepted jobs ({NO_SHOW_REVIEW} in {NO_SHOW_DAYS} days) can lead to removal from the network, but only after a conversation with you. Nobody is ever removed
            automatically.
          </li>
          <li>
            <strong>Flagged jobs.</strong> {FLAG_REVIEW} flagged jobs in {FLAG_DAYS} days put you in front of our team for a conversation. Nobody is removed automatically for
            this either, and declining a job can never flag anything: only jobs you accepted and finished are checked.
          </li>
        </ul>
        <p>
          If {PATTERN_PAIR_JOBS} or more jobs you accepted for the same owner in {PATTERN_DAYS} days end without Job done (cancelled after On my way, or nobody there by the promised
          time), or {PATTERN_TRADIE_CANCELS} or more jobs you accepted in {PATTERN_DAYS} days are cancelled after On my way, our team may look at them and talk to you. That is never a
          removal by itself, and it is never counted as declining.
        </p>
        <p>You can pause offers yourself at any time with the Pause switch in your profile, for a holiday or a busy week, with no penalty.</p>
      </Section>

      <Section n={9} title="Working alone in holiday homes, safety and damage">
        <p>
          Many of these houses are empty when you arrive, and some have guests in them. The job screen tells you when a guest is staying (or the
          owner is not sure), and whether the owner said you may let yourself in if nobody answers. <strong>Guest staying: knock and wait. Don&rsquo;t
          let yourself in unless nobody answers after 5 minutes and the owner said that&rsquo;s OK.</strong> Entering an occupied property without
          knocking is a serious breach of this agreement. If there is a guest in the house, introduce yourself and say who sent you.
        </p>
        <p>
          You manage the safety of your own work: follow your own health and safety practices, and do not enter or carry on if something feels
          wrong. Owners tell us the hazards they know of, and we show them to you before you accept. If you find a hazard at a property (gas,
          exposed wiring, water near power, a rotten deck, a dog), make it safe or stop, and report it from the job screen with
          <strong> Found a hazard at this property?</strong>: it is saved to the property for the next tradie and the owner is texted.
        </p>
        <p>
          If an owner says you damaged something, the claim goes to your public liability insurer. {n} supplies the job&rsquo;s photos and times.
        </p>
        <p>
          <strong>Your staff.</strong> You can send an employee or someone who works for you to a job you accepted. Your business is responsible for them as
          if you did the job yourself: their work, their conduct, the access codes they see, and anything they damage. They must hold any licence the work
          needs, be covered by your insurance, and follow this agreement (knocking when a guest is staying, the photos, the taps). Anyone else, such as
          another business, may not do a job you accepted.
        </p>
        <p>
          <strong>Claims caused by your work.</strong> If {n} has to pay a claim, a refund beyond your share or costs because of something you or your staff
          did or did not do on a job (damage, injury, bad work, or breaking this agreement), you agree to cover it. That is what your insurance is for.
          This does not apply to anything {n} caused.
        </p>
      </Section>

      <Section n={10} title="Your own clients, and app jobs stay in the app">
        <p>
          <strong>Your own clients.</strong> You can bring owners you already work for to {n}: send them an invite from the app, or they can add you from their
          property page with &ldquo;Bring your own tradie&rdquo; (you still sign up and are approved as normal). Once they accept for a property, jobs between you and
          that property take a <strong>{ownFee} platform fee</strong> instead of {fee} on the first {line} of the job&rsquo;s price, on everything the {fee} applies to:
          the menu price, the surcharges, the call-out, quotes and hourly work. Above {line} it is {aboveFee}, as for every job. Parts are as in section 5. {ownFee} covers the card fees (about 3%), the automatic texts and payment, and chasing late payers. You are
          also the first choice for that property in your trade. Every other tradie and trade at that property stays at {fee}. This does not apply to a property where{" "}
          {n} has already offered you a job, or you have done one: we check that by the property&rsquo;s address and map pin, not by the owner&rsquo;s account.
        </p>
        <p>
          <strong>Owners {n} introduces</strong> stay at the normal fee ({fee} to {line}, {aboveFee} above) for every job through the app, however long you have known them. There is no time limit and
          no buyout.
        </p>
        <p>
          <strong>One rule: a job booked in the app is finished and paid through the app.</strong> Finishing an app job outside the app (taking the owner&rsquo;s payment
          for it directly, or agreeing to do it off the app once it is booked) can lead to removal from the network. A person decides, after talking to you, as with
          everything else here.
        </p>
      </Section>

      <Section n={11} title="Ending this">
        <p>
          You can stop at any time: pause offers, or email us to close your account. A person on our team can remove you from the network, and
          will tell you why; the app never does it by itself, and declining jobs is never a reason. Jobs you have accepted are finished and paid
          under this agreement either way.
        </p>
        <p>
          <strong>A job reported as done that was not done, including a faked location or faked photos, means removal from {n}, and any money paid to you
          for it must be repaid.</strong>
        </p>
      </Section>

      <Section n={12} title="If we disagree">
        <p>
          Talk to us first: ring or email us and a person will look at it with you. If that does not sort it within 20 working days, either of us can
          suggest mediation with an independent mediator, and either of us, you or {n}, can take it to the Disputes Tribunal (for claims inside its limit) or
          a court. Nothing here stops either of us doing that. While a disagreement is open, jobs you have already accepted carry on as normal.
        </p>
      </Section>

      <Section n={13} title="Changes">
        <p>
          If we change this agreement, the date at the top moves and you are asked to agree to the new version in the app (on your home page)
          before your next offer. We give you {FEE_NOTICE_DAYS} days&rsquo; notice by text before a change to the platform fee applies to you. New Zealand
          law applies.
        </p>
      </Section>
    </LegalPage>
  );
}
