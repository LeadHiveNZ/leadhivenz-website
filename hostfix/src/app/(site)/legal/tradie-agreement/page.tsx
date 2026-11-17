import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";

/**
 * THE TRADIE AGREEMENT. One page, plain English, written from what the
 * software actually does (docs/LEGAL-TODO.md, section 3). A tradie agrees to
 * it in the app before they can be approved, and the time is recorded.
 */
export const metadata: Metadata = {
  title: "Tradie agreement",
  description: `How working with ${brand.name} works: the offers, the prices, the pay, and what we expect from each other.`,
};

const UPDATED = "17 November 2026";

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
            <strong>Public liability insurance</strong> in your own name, with the insurer, policy number and expiry date entered in your profile.
            We do not offer jobs to anyone without current insurance, and the app stops offering you jobs the day it expires.
          </li>
          <li>
            <strong>Current licences</strong> for any plumbing, gas or electrical work, with the number and expiry in your profile. Licensed work
            is only ever offered to someone whose licence is on file and in date. We check each one against the public register.
          </li>
          <li>
            <strong>Police vetting</strong>, arranged by us, because you will be entering homes that may have guests in them. You agree to it as
            part of joining.
          </li>
          <li><strong>Bank details with Stripe</strong>, set up from your profile, so we can pay you.</li>
        </ul>
        <p>Tell us within 7 days if any of these change or lapse.</p>
      </Section>

      <Section n={3} title="How offers work">
        <p>
          A job is offered by text to one tradie at a time. The first choice has <strong>15 minutes</strong> to accept, then it moves to the next,
          then to everyone who does that trade. Open the link and press <strong>Accept job</strong>; opening the link alone does nothing. Pass
          whenever you cannot do it, with no penalty for passing.
        </p>
        <p>
          Before you accept you see the job, the suburb, what it pays and the time you must be on site by. <strong>After</strong> you accept you
          see the address, the access notes and the owner&rsquo;s number.
        </p>
      </Section>

      <Section n={4} title="What accepting commits you to">
        <ul>
          <li>Being on site by the time shown in the offer: within 24 hours for a normal job, within 4 hours for an urgent one.</li>
          <li>Tapping <strong>I have arrived</strong> when you get there. That tap is how we measure our promise to the owner, so do it at the door, not later.</li>
          <li>Doing the job described, to a tradesperson&rsquo;s standard, and tidying up after yourself.</li>
          <li>Taking at least one photo of the finished work and writing what you did. The app will not let you finish a job without them.</li>
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
          <li>Your share is the amount in the offer. Urgent and after-hours surcharges, and approved parts, go to you in full.</li>
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
        </ul>
      </Section>

      <Section n={7} title="If the owner raises a problem">
        <p>
          An owner can raise a problem from their job page. If they do within a day of the job, your payment is held until it is sorted. Our
          team looks at the photos, the notes and both sides, then decides: the work stands and you are paid in full, or part or all of the job is
          refunded and your payment is reduced in proportion. If you have already been paid, you agree that we may take the refunded amount back
          from your next payments. We will always tell you why.
        </p>
      </Section>

      <Section n={8} title="Your record, and first choice">
        <p>
          The app keeps a simple scorecard: how often you accept offers and how often you arrive on time, over the last 30 days. Tradies at 80%
          or better on both are made first choice for their trade, which means they see every job first. First choice can be swapped, paused or
          removed on that record. You can pause offers yourself at any time with the Pause switch in your profile, for a holiday or a busy
          week, with no penalty.
        </p>
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
          You can stop at any time: pause offers, or email us to close your account. We can remove you from the network at any time, and will
          tell you why. Jobs you have accepted are finished and paid under this agreement either way.
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
