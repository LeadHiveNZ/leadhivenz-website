import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, Section } from "@/components/LegalPage";

/**
 * THE PRIVACY STATEMENT. Written from what the software holds and shares
 * (docs/LEGAL-TODO.md, section 1), in plain English, for the New Zealand
 * Privacy Act 2020. Change this page whenever the software starts holding or
 * sharing something new.
 */
export const metadata: Metadata = {
  title: "Privacy statement",
  description: `What ${brand.name} holds about you, why, who sees it, and how to ask for it or have it removed.`,
};

const UPDATED = "23 November 2026";

export default function Page() {
  const n = brand.name;
  return (
    <LegalPage
      title="Privacy statement"
      updated={UPDATED}
      intro={`${n} arranges maintenance for holiday homes. To do that we hold details about property owners, the people who report problems, and the tradies who fix them. This page says what we hold, why, who sees it, and what you can ask us to do. It is written for people, not lawyers.`}
    >
      <Section n={1} title="Who we are">
        <p>
          {n} is run from New Zealand. We are the agency for the details described here under the Privacy Act 2020. Our contact details are at the
          bottom of this page.
        </p>
      </Section>

      <Section n={2} title="What we hold, and why">
        <p>
          <strong>If you are a property owner or manager:</strong> your name, mobile number, email address and the town you live in; each property&rsquo;s
          address; the access notes you write for tradies, such as a lockbox code, an alarm code or where the water shuts off; and any photos you add
          of the property. We hold these so that a tradie can get to the right place, get in, and fix the problem. We also hold the jobs logged at
          your properties, their photos, and what you were charged.
        </p>
        <p>
          <strong>If you report a problem as a cleaner, co-host or guest:</strong> your name and mobile number if you give them, what you wrote,
          and your photos. You do not need an account. We hold these so the owner and the tradie know what is wrong and can reach you if they
          need to. If an owner adds you to their team, we hold the name they gave you, your mobile number, which of their properties you may
          report on, and when a phone of yours typed the code we texted you. Each owner who adds you sees only their own properties and the name
          they gave you, never another owner&rsquo;s.
        </p>
        <p>
          <strong>If you are a guest staying when a tradie comes:</strong> the owner or their team may give us your first name and mobile number
          when they log the job. We use that number only for that job&rsquo;s texts: when the tradie is coming, and when they are on the way. The
          owner who gave it and our team can see it; the tradie sees only your first name.
        </p>
        <p>
          <strong>Hazards at a property</strong> (&ldquo;anything a tradie should know to stay safe&rdquo;), written by the owner or added by a tradie
          from a job, are kept with the property and shown to tradies offered a job there, before they accept.
        </p>
        <p>
          <strong>If you are a tradie:</strong> your name, business name, mobile number, email address, the work you do, your licence numbers and
          when they expire, your public liability insurance (insurer, policy number and expiry), your tax number, the days you work, and your
          record with us (jobs offered, accepted, and whether you arrived on time). Our team may write notes about you that you cannot see, for
          example after a call with an owner.
        </p>
        <p>
          <strong>If you fill in a form on our public pages:</strong> what you typed, which advertisement or website you came from, and the page
          you landed on, so we know which ads work.
        </p>
        <p>
          <strong>Where a tradie was when they tapped &ldquo;I have arrived&rdquo;, &ldquo;Job done&rdquo; or &ldquo;Could not get in&rdquo;, and when they sent each
          before and after photo</strong>, if their phone allowed it. We ask at those moments only, to show that our response promise was kept and that the
          tradie was at the property, and compare it with the property&rsquo;s map pin. We do not track anyone&rsquo;s location at any other time. From each
          photo we also keep the time the photo itself says it was taken, if it has one; the rest of the hidden details a phone adds to a photo,
          including where it was taken, are removed on the phone before it is sent, where the phone allows it.
        </p>
        <p>
          <strong>Each property&rsquo;s map pin</strong>, looked up from its address and checked by the owner. If an owner presses &ldquo;I&rsquo;m at the property
          now&rdquo;, their phone&rsquo;s location is used once, to place the pin, and nothing else is kept.
        </p>
        <p>
          <strong>If a tradie invites you as their client, or an owner invites their own tradie</strong>, the name and the mobile number or email address
          they typed. We use it only to send that one invite link, and to show the person who sent it whether it has been used.
        </p>
        <p>
          <strong>Every text and email we send</strong>, with its wording, so we can show what was said and when. Sign-in codes and one-tap links
          are blanked out once sent.
        </p>
        <p>
          <strong>A permanent record of every change to a job and every movement of money</strong>, with who made it. This record cannot be
          edited or deleted, by us or anyone else, because it is how we show owners and tradies what happened and what was paid.
        </p>
      </Section>

      <Section n={3} title="What we do not hold">
        <ul>
          <li>Card numbers. Stripe holds your card and gives us a token. We cannot see or store the number.</li>
          <li>Tradies&rsquo; bank details and identity documents. Stripe holds those too, for paying tradies.</li>
          <li>Passwords. You sign in with a six-digit code sent to your email or mobile.</li>
          <li>
            Your internet address. When you send a public form we use a scrambled version of it for a few minutes to stop robots flooding the
            form, then it is gone.
          </li>
        </ul>
      </Section>

      <Section n={4} title="Who sees what">
        <ul>
          <li>
            <strong>A tradie</strong> sees a property&rsquo;s suburb and what needs fixing before they accept a job. They see the address, the access
            notes and the property photos <strong>only after accepting</strong>, and the photos only while that job is open. After accepting, the
            tradie can see the owner&rsquo;s mobile number, and the owner can see the tradie&rsquo;s business name and mobile number, so they can talk about
            the job.
          </li>
          <li>
            <strong>If a guest or cleaner reports a problem</strong>, their name and number are shown to the owner, to the tradie who takes the
            job, and to our team.
          </li>
          <li>
            <strong>Our team</strong> (the dispatcher and the people who run {n}) can see everything above, including access codes, because they
            step in when something goes wrong.
          </li>
          <li>
            <strong>Other owners and other tradies see nothing of yours.</strong> Every page in the app only shows the signed-in person their own
            properties, jobs and details.
          </li>
        </ul>
      </Section>

      <Section n={5} title="Companies we use to run the service">
        <p>Your details pass through these companies, each only for the job named:</p>
        <ul>
          <li>Supabase: our database and photo storage, hosted in Sydney, Australia.</li>
          <li>Vercel: hosts the website, with servers in Sydney.</li>
          <li>Stripe: takes payments from owners, pays tradies, and checks tradies&rsquo; identity for payouts. Stripe is based in the United States.</li>
          <li>Resend: sends our emails.</li>
          <li>ClickSend or Twilio: sends our texts.</li>
          <li>
            Toitū Te Whenua Land Information New Zealand (LINZ): when a property is added or its address changes, we send the street address (not your
            name) to the government&rsquo;s address list to find it on the map. The map on the property page loads its pictures from LINZ Basemaps or
            OpenStreetMap, which see the address of your internet connection, as any website does.
          </li>
          <li>
            Meta (Facebook and Instagram): when someone fills in a form on our public pages after seeing one of our ads, we send Meta a scrambled
            copy of the email address and phone number so Meta can tell us the ad worked. Meta cannot read the scrambled values. Nothing inside
            the signed-in app is sent to Meta.
          </li>
        </ul>
        <p>Some of these companies hold your details outside New Zealand, in Australia and the United States. We only use companies with privacy protections comparable to New Zealand&rsquo;s.</p>
      </Section>

      <Section n={6} title="Cookies">
        <p>
          We use one cookie to keep you signed in, one for our team&rsquo;s sign-in, and one that remembers for seven days which public form you filled
          in, so you are not asked again. Our public pages may carry Meta&rsquo;s own cookie for ad measurement. There is no advertising tracking inside
          the app once you are signed in.
        </p>
      </Section>

      <Section n={7} title="How long we keep things">
        <ul>
          <li>Account details and property details: while you have an account, and up to 7 years afterwards where they are part of a financial record.</li>
          <li>Jobs, photos, charges, payouts and the permanent record: 7 years, because they are financial records.</li>
          <li>Details from a public form that never becomes an account: 12 months.</li>
          <li>Texts and emails we sent: 7 years, with codes and links blanked out.</li>
        </ul>
      </Section>

      <Section n={8} title="Your rights">
        <p>
          You can ask us for a copy of everything we hold about you, and ask us to correct anything that is wrong. Email us and we will reply
          within 20 working days, which is the time the Privacy Act allows.
        </p>
        <p>
          You can ask us to delete your details. We will delete or anonymise everything we lawfully can. We cannot delete financial records
          (what was charged and paid) inside the 7 years the law requires us to keep them, and we cannot edit the permanent record of jobs and
          payments, but your name and contact details can be removed from it.
        </p>
        <p>
          You can stop texts from us at any time by replying STOP (START turns them back on). We keep the number and when you replied, so we never
          text it again by mistake. Sign-in codes you ask for are still sent. Tradies can also pause offers with the Pause switch in their profile.
        </p>
        <p>
          <strong>App notifications.</strong> If you turn on notifications in the app, we keep what your phone or browser gives us to reach it (an
          address at your phone&rsquo;s notification service and two keys), linked to your account, and delete it when you turn notifications off or
          the service says it no longer works. Notifications never contain an address or door code.
        </p>
      </Section>

      <Section n={9} title="Access codes and keeping things safe">
        <p>
          Lockbox and alarm codes are the most sensitive thing we hold. They are stored in our database with access restricted by the database
          itself, shown only to the one tradie who accepted the job and to our team, and never sent in a text or email. If we ever learn that a
          code has been exposed, we will tell the owner the same day so it can be changed, and we recommend a lockbox or smart lock whose code
          you can change yourself.
        </p>
        <p>If a privacy breach is likely to cause serious harm, we will notify the people affected and the Privacy Commissioner, as the Act requires.</p>
      </Section>

      <Section n={10} title="Changes to this page">
        <p>
          When the software starts holding or sharing something new, this page changes and the date at the top moves. If a change matters to
          you, for example a new company we share with, we will tell you by email.
        </p>
      </Section>
    </LegalPage>
  );
}
