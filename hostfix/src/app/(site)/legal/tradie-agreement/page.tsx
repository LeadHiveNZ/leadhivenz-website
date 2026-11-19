import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";
import { launchMarket } from "@config/markets";
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

const UPDATED = "19 November 2026";

export default function Page() {
  const n = brand.name;
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
      </Section>

      <Section n={2} title="What you need before your first job">
        <ul>
          <li>
            <strong>Public liability insurance</strong> in your own name, with the insurer, policy number and expiry date entered in your profile,
            and the certificate of currency from your insurer uploaded there (a PDF, JPG or PNG). Only our team and you can open the certificate.
            When you renew, upload the new one: we keep the earlier ones as a record. We do not approve anyone, or offer them jobs, without
            current insurance and its certificate on file, and the app stops offering you jobs the day it expires.
          </li>
          <li>
            <strong>Current licences</strong> for any plumbing, gas or electrical work, with the number and expiry in your profile. Licensed work
            is only ever offered to someone whose licence is on file and in date. We check each one against the public register.
          </li>
          <li>
            <strong>Your criminal record</strong>, because you will be entering homes that may have guests in them. You request your own copy
            from the Ministry of Justice (it is free, and usually takes about a week) and send it to us before your first job. We treat it as
            confidential and keep only a note that we have seen it.
          </li>
          <li><strong>Bank details with Stripe</strong>, set up from your profile, so we can pay you.</li>
          <li>
            <strong>A Licensed Building Practitioner (LBP) number</strong> is optional. Add it to your profile if you have one: some building work
            needs it, most jobs do not.
          </li>
        </ul>
        <p>
          You can sign in to your own account as soon as you have applied, to fill these in. Only our team can approve you, and nothing is
          offered to you until we do. We text you when you are approved.
        </p>
        <p>Tell us within 7 days if any of these change or lapse.</p>
      </Section>

      <Section n={3} title="How offers work">
        <p>
          A job is offered by text to one tradie at a time. The first choice has <strong>15 minutes</strong> to accept, then it moves to the backup,
          then to everyone who does that trade. Open the link and press a button to accept; opening the link alone does nothing. On a normal job
          you accept by choosing the {WINDOW_HOURS}-hour window you will arrive in, inside the 24 hours; the owner is told that window. Pass whenever you
          cannot do it.
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
          Before you accept you see the job, the suburb, what it pays and the time you must be on site by. <strong>After</strong> you accept you
          see the address, the access notes and the owner&rsquo;s number.
        </p>
      </Section>

      <Section n={4} title="What accepting commits you to">
        <ul>
          <li>Being on site by the end of the window you chose for a normal job, or by the deadline for an urgent one (within 4 hours).</li>
          <li>
            Taking at least one <strong>before</strong> photo in the app and tapping <strong>I have arrived</strong> at the door, with your phone&rsquo;s
            location on. That tap is how we measure the time, and it decides whether the urgent and after-hours shares are paid. The owner can tell us if
            you are not there.
          </li>
          <li>Doing the job described, to a tradesperson&rsquo;s standard, and tidying up after yourself.</li>
          <li>
            Taking at least one <strong>after</strong> photo of the finished work in the app, writing what you did, and tapping <strong>Job done</strong> at
            the property, with your location on. The app will not let you arrive without a before photo or finish without an after photo.
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
          amount for that job.</strong> You cannot ask the owner for more, charge them directly, or renegotiate on site.
        </p>
        <p>
          If you arrive and the job is not what was described (the dripping tap is a cracked pipe), tap <strong>This needs a quote</strong>. You are
          paid the call-out for coming, and the job becomes a quote the owner says yes or no to before any more work starts. Anything the owner has
          not approved is at your own cost.
        </p>
        <p>
          Small parts are included in the menu price. Bigger parts are charged to the owner at cost when you add them to the job with the receipt;
          above a set amount the app asks the owner first.
        </p>
      </Section>

      <Section n={6} title="Pay">
        <ul>
          <li>Your share is the amount in the offer. On an urgent or after-hours job, your share of the surcharge is in that amount, like the rest of the price: the surcharge less the 15% platform fee. Approved parts are paid back to you in full, at cost.</li>
          <li>
            <strong>The urgent share is paid only if you tap I have arrived by the urgent deadline</strong> shown in the offer. After the deadline the
            urgent surcharge is not charged to the owner at all, so there is no share of it to pay. The rest of the job is paid as normal.
          </li>
          <li>
            <strong>The after-hours share is paid only if you arrive outside working hours</strong> (before 7am, after 4:30pm, or at the weekend). If you
            come within working hours, the after-hours surcharge is not charged, and the rest of the job is paid as normal.
          </li>
          <li>
            Once the owner&rsquo;s card has been charged, your payment is sent 24 hours after the job finishes and reaches your bank about 5 to 6 working
            days after the job. We will never promise you faster than Stripe actually pays.
          </li>
          <li>Your Pay page in the app lists every job and every payment. Statements are there for your accountant.</li>
          <li>
            If the owner&rsquo;s card fails, we keep trying it for four days and then chase them. Your payment goes out when the charge succeeds. If it
            never does, we will talk to you about it; we do not simply leave you unpaid without a conversation.
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

      <Section n={7} title="If the owner raises a problem">
        <p>
          An owner can raise a problem from their job page. If they do within a day of the job, your payment is held until it is sorted. Our
          team looks at the photos, the notes and both sides, then decides: the work stands and you are paid in full, or part or all of the job is
          refunded and your payment is reduced in proportion. If you have already been paid, we take your share of the refund back from that
          payment through Stripe; if that cannot be done, you agree to repay it. We will always tell you why.
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
        <p>You can pause offers yourself at any time with the Pause switch in your profile, for a holiday or a busy week, with no penalty.</p>
      </Section>

      <Section n={9} title="Working alone in holiday homes">
        <p>
          Many of these houses are empty when you arrive, and some have guests in them. Follow your own health and safety practices, do not
          enter if something feels wrong, and if there is a guest in the house, introduce yourself and say who sent you. If you find anything
          unsafe at a property (gas, exposed wiring, water near power), make it safe or stop, and tell us straight away.
        </p>
      </Section>

      <Section n={10} title="Owners' work">
        <p>
          You agree not to take {n} owners&rsquo; maintenance work directly for 12 months after your last job for them. The owner came to you through
          us; that is what pays for the offers you receive.
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

      <Section n={12} title="Changes">
        <p>
          If we change this agreement, you will be asked to agree to the new version in the app before your next offer, and the date at the top
          will move. New Zealand law applies.
        </p>
      </Section>
    </LegalPage>
  );
}
