import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";

/**
 * INSURANCE: who carries what. Plain English, from docs/LEGAL-TODO.md
 * section 5 and the free-to-join decision (DECISIONS.md, 2026-11-17).
 */
export const metadata: Metadata = {
  title: "Insurance",
  description: `Who is insured for what when a ${brand.name} tradie works at your property.`,
};

const UPDATED = "17 November 2026";

export default function Page() {
  const n = brand.name;
  return (
    <LegalPage title="Insurance" updated={UPDATED} intro={`Three people are involved in every job: you, the tradie and ${n}. Here is who is insured for what.`}>
      <Section n={1} title="The tradie">
        <p>
          Every tradie on {n} must hold their own <strong>public liability insurance</strong>, in their own business name. They enter the insurer,
          policy number and expiry date in their profile, and the app stops offering them jobs the day the policy expires. Public liability
          insurance covers damage the tradie causes to your property or to someone else&rsquo;s while working, for example a burst fitting that floods
          a floor. A claim for that damage is made against the tradie&rsquo;s policy. We will give you their insurer&rsquo;s details and help you make the
          claim.
        </p>
      </Section>

      <Section n={2} title={n}>
        <p>
          {n} arranges the work and handles the money. We hold, or are arranging, our own public liability cover for our part in that. We do not
          insure your property, its contents, or your bookings. If you believe {n} itself has caused you a loss, raise it with us from the job
          page and we will deal with it directly.
        </p>
      </Section>

      <Section n={3} title="You, the owner">
        <p>
          Your own house and contents insurance stays as it is. {n} does not replace it. Check two things with your insurer: that your policy
          covers short-stay letting, as many standard policies do not, and that letting tradespeople in with a lockbox code does not affect your
          cover. Most policies are fine with both, but ask.
        </p>
      </Section>

      <Section n={4} title="What is not covered by anyone here">
        <ul>
          <li>Faults that were already there before the tradie arrived.</li>
          <li>Lost bookings, refunds to guests, or bad reviews caused by a fault at your property.</li>
          <li>Damage caused by guests.</li>
        </ul>
      </Section>
    </LegalPage>
  );
}
