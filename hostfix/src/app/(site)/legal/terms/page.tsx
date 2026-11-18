import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";

/**
 * THE OWNER TERMS. Plain English, written from what the software actually
 * does (docs/LEGAL-TODO.md, section 2) under the free-to-join model
 * (DECISIONS.md, 2026-11-17). Change this page whenever a promise changes.
 */
export const metadata: Metadata = {
  title: "Terms of service",
  description: `How ${brand.name} works for property owners: free to join, fixed prices, charged when a job is done.`,
};

const UPDATED = "18 November 2026";

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
          {n} arranges maintenance at your property. You, your cleaner or your guest reports a problem. We offer it to a local tradie we have
          checked, who comes and fixes it. Your saved card is charged the fixed price when the job is done. We are the business you deal with:
          you pay us, we pay the tradie, and you can raise any problem with us.
        </p>
      </Section>

      <Section n={2} title="Joining and your card">
        <p>
          There is no joining fee and no monthly fee. To cover a property you add it to the app and put a card on file with Stripe, our payment
          company. We never see your card number. Nothing is charged until a job is done at your property.
        </p>
      </Section>

      <Section n={3} title="Prices">
        <ul>
          <li>
            <strong>Menu jobs have a fixed price</strong>, shown before anyone is sent, including GST and the call-out. The price you see when you
            log the job is the price you pay, even if we change the menu later.
          </li>
          <li>
            <strong>Urgent</strong> (on site within 4 hours: the tradie drops what they are doing) adds a surcharge, and work before 7am, after
            4:30pm or at the weekend adds an after-hours surcharge. The amount of each is on the price list and shown before you choose it, and
            like the rest of the price it is fixed: nothing is added on the day.
          </li>
          <li>
            <strong>Jobs not on the menu</strong> cost a fixed call-out for a tradie to come and look, then a quote. Any quote over NZ$600, or over
            the limit you set for that property, stops until you say yes. If you say no, the call-out is still charged.
          </li>
          <li>
            <strong>Parts.</strong> Small parts are in the price. Bigger parts are charged at cost with the receipt, and above a set amount we ask
            you first.
          </li>
        </ul>
      </Section>

      <Section n={4} title="Our promise, and what happens if we miss it">
        <p>
          A tradie on site within 24 hours of a job being sent out, or within 4 hours for an urgent job, counting nights and weekends. &ldquo;On
          site&rdquo; is the tradie&rsquo;s own tap of &ldquo;I have arrived&rdquo; at your door.
        </p>
        <p>
          If nobody is on site in time, <strong>the call-out portion of that job is on us</strong>: we credit you the call-out amount (up to the
          price of the job) against your next charge, automatically, without you asking. This applies once per property per month. It does not
          apply when the tradie could not get in, when you cancelled the job, or when a guest&rsquo;s report was still waiting for your approval.
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
      </Section>

      <Section n={6} title="Access to your property">
        <p>
          You give us the access notes a tradie needs. They are shown only to the tradie who accepted the job, and only after accepting. We
          recommend a lockbox or smart lock with a code you can change. You are responsible for the notes being right; a tradie who cannot get in
          because of them is paid the call-out, and that is charged to you.
        </p>
      </Section>

      <Section n={7} title="Charging your card">
        <p>
          When the tradie finishes, with a photo and a note, your card is charged the job&rsquo;s price. There is no approval step at that point,
          because you approved the price when the job was logged. If the charge fails we try again, a day apart, four times, and then a person
          contacts you. Jobs cannot be logged at a property while a charge is outstanding.
        </p>
        <p>One statement a month in the app shows every job, charge and credit, with the GST inside the total.</p>
      </Section>

      <Section n={8} title="If something is wrong with the work">
        <p>
          Raise it from the job page. If you do so within a day of the job, the tradie&rsquo;s payment is held. We look at the photos, the notes and
          both sides and decide within 5 working days: the work stands, a part refund, or a full refund to your card. If work fails within 30 days
          because of the tradie&rsquo;s workmanship, the tradie comes back at no charge. Your rights under the Consumer Guarantees Act are not affected
          by any of this.
        </p>
      </Section>

      <Section n={9} title="Leaving">
        <p>
          You can remove a property or close your account at any time from the app. There is nothing to cancel and nothing to refund, because
          nothing is charged except finished jobs. Jobs already under way are finished and charged under these terms.
        </p>
      </Section>

      <Section n={10} title="What we are not">
        <p>
          We are not an insurer and not an emergency service. If there is danger (fire, gas, sparks, anyone hurt), call 111 first. We arrange
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
