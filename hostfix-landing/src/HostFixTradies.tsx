import { useState, type FormEvent } from "react";

/**
 * HostFix tradie landing page: the one link to send a plumber, sparky or
 * handyman instead of an email and an attachment. Everything from the
 * two-page sheet, the walkthrough video, and a short "put my hand up" form.
 *
 * Change this line only:
 */
export const TRADIE_LOOM_EMBED_URL = "https://www.loom.com/embed/73cf5f62d6ae4245887645b97ec9e4ce";

export type TradieLead = {
  name: string;
  phone: string;
  email: string;
  trade: string;
  town: string;
  /** "yes" or "not_yet": public liability insurance in their own name */
  insured: string;
  licence: string | null;
  message: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

type Props = { saveLead: (lead: TradieLead) => Promise<{ ok: boolean }> };

const TRADES: [string, string][] = [
  ["plumber", "Plumber"],
  ["electrician", "Sparky"],
  ["handyman", "Handyman"],
  ["gasfitter", "Gasfitter"],
  ["other", "Other"],
];

const PAY: { trade: string; rows: [string, number][] }[] = [
  {
    trade: "Plumber",
    rows: [
      ["Dripping tap or tap washer", 200],
      ["Running toilet or cistern repair", 200],
      ["Shower head or mixer replace", 200],
      ["No hot water, first-hour diagnosis", 200],
      ["Blocked toilet, sink or shower drain", 210],
      ["Frozen pipe thaw and check", 240],
      ["Burst pipe make-safe, first hour", 320],
    ],
  },
  {
    trade: "Sparky",
    rows: [
      ["Power point or light switch replace", 190],
      ["Tripping circuit, first-hour diagnosis", 190],
      ["Oven or cooktop fault, first-hour diagnosis", 190],
      ["Switchboard and RCD safety test", 190],
      ["Light fitting replace, up to 2", 190],
      ["Extractor fan replace", 220],
      ["Heated towel rail replace", 230],
    ],
  },
  {
    trade: "Handyman",
    rows: [
      ["Shelf, hook or mirror hanging", 130],
      ["Light bulbs, up to 5", 140],
      ["Smoke alarm replace or battery, up to 3", 140],
      ["Door handle, latch or lock adjust", 140],
      ["Sticking door or sliding door track", 150],
      ["Lockbox or smart lock install", 170],
      ["TV wall mount or re-secure", 180],
      ["Reseal a shower or bath", 230],
    ],
  },
];

const STEPS: [string, string][] = [
  ["A text arrives", "The job, the suburb, what it pays you, and the time you need to be on site by. You have 15 minutes to take it. Pass whenever you like, no penalty."],
  ["Accept, and you're in", "You get the address, the lockbox code or access notes, and the owner's number. Nobody needs to let you in."],
  ["Tap \"I've arrived\"", "At the door. That tap is how we measure the promise to the owner, so do it when you get there."],
  ["Do the job, photo, finish", "Do what the text said, take at least one photo of the finished work, write a line on what you did, tap finish."],
  ["Get paid", "The owner's card is charged when you finish. Your share is sent 24 hours later and lands in your bank in about 5 to 6 working days. No invoice."],
];

const FAQS: [string, string][] = [
  ["What does it cost me?", "Nothing. No lead fees, no subscription, nothing if you never accept a job. HostFix takes 15% inside the fixed price, same as every dollar, and you see your share before you accept."],
  ["What if the job isn't what the text said?", "Tap \"This needs a quote\". You're paid the call-out ($190) for coming, you give a price, and the owner says yes or no before any more work starts. Don't start anything the owner hasn't approved."],
  ["Urgent and after hours?", "Within 4 hours adds $42.50 to your pay when you're on site in time; late, and the owner isn't charged it. Arriving before 7am, after 4:30pm or at the weekend adds $119. Both are in the text before you accept. Urgent work is never discounted."],
  ["Parts?", "Small parts (washers, fittings, a cartridge) are in the price. Bigger parts go to the owner at cost when you add them to the job with the receipt. Over a set amount the app asks the owner first."],
  ["Couldn't get in?", "Tap \"Could not get in\" with a photo at the door. You're paid the call-out."],
  ["What if the owner complains?", "They have a day to raise it. Your payment holds while a person looks at the photos and both sides. Work stands, you're paid in full. A refund reduces your pay in proportion. You're always told why."],
  ["Something I fixed fails?", "Within 30 days and caused by your work, you come back and put it right at no charge. Same as any good tradie."],
  ["Can I pause?", "Any time, with the Pause switch. Holiday, busy week, no penalty. Tradies who accept and turn up on time become first choice for their trade and see every job first."],
  ["Can I take the owner's other work directly?", "Not for 12 months after your last HostFix job for them. They came to you through us; that's what pays for the offers."],
  ["Why do you need my insurance certificate?", "Because owners are letting us into their houses with a lockbox code. Public liability insurance in your own name, certificate of currency uploaded, is the whole promise to them. No certificate, no jobs. About $20 to $30 a month if you don't have it yet."],
];

export function HostFixTradies({ saveLead }: Props) {
  const [done, setDone] = useState(false);

  return (
    <div className="hf">
      <header className="hf-hero">
        <div className="hf-wrap">
          <nav className="hf-nav">
            <Logo />
            <span className="hf-pill">
              <span className="hf-dot" /> For tradies
            </span>
          </nav>

          <div className="hf-hero-grid">
            <div className="hf-hero-copy">
              <p className="hf-eyebrow">Plumbers, sparkies and handymen</p>
              <h1 className="hf-h1">
                Fixed-price jobs at holiday homes, <span className="hf-mark">texted</span> to you.
              </h1>
              <p className="hf-lead">
                HostFix is a maintenance network for Airbnb and holiday-home owners. Something breaks, the job is offered to a vetted local
                tradie by text at a fixed price. Tap accept, get the lockbox code, do it, photo, paid. No quoting, no invoicing, no chasing.
              </p>
              <ul className="hf-ticks">
                <li>Free to join. No lead fees, no subscription</li>
                <li>You see your pay before you accept</li>
                <li>Paid out the next day, without an invoice</li>
              </ul>
            </div>

            <div className="hf-hero-form">
              {done ? (
                <div className="hf-card hf-done">
                  <p className="hf-done-title">Cheers. You're on the list.</p>
                  <p>Joe will ring you for 10 minutes. Have your public liability certificate handy; a photo of it is all we need.</p>
                  <a href="#video" className="hf-btn hf-btn-plum">
                    Watch the 4-minute walkthrough
                  </a>
                </div>
              ) : (
                <HandUpForm saveLead={saveLead} onDone={() => setDone(true)} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="hf-section" id="video">
          <div className="hf-wrap">
            <p className="hf-kicker">Watch</p>
            <h2 className="hf-h2">The app from your side, in 4 minutes</h2>
            <div className="hf-video-frame">
              <iframe src={TRADIE_LOOM_EMBED_URL} title="HostFix for tradies" allow="fullscreen" allowFullScreen loading="lazy" />
            </div>
          </div>
        </section>

        <section className="hf-section">
          <div className="hf-wrap">
            <p className="hf-kicker">How a job works</p>
            <h2 className="hf-h2">Five taps. No paperwork.</h2>
            <ol className="hf-steps">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="hf-step">
                  <span className="hf-step-n">{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="hf-section">
          <div className="hf-wrap">
            <p className="hf-kicker">Pay</p>
            <h2 className="hf-h2">What the common jobs pay you.</h2>
            <p className="hf-note">
              Queenstown prices, GST included, your share after HostFix's 15%. Other towns get their own menu set from local rates. Urgent adds
              $42.50 when you're on site within 4 hours, after hours adds $119, both yours. Off-menu jobs: $190 to come and look, then your quote.
            </p>
            <div className="hf-pay-grid">
              {PAY.map((group) => (
                <div key={group.trade} className="hf-card hf-prices">
                  <h3 className="hf-h3 hf-pay-title">{group.trade}</h3>
                  {group.rows.map(([job, pay]) => (
                    <div key={job} className="hf-price-row">
                      <span>{job}</span>
                      <span className="hf-price">${pay}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hf-section">
          <div className="hf-wrap">
            <div className="hf-founding">
              <div>
                <p className="hf-kicker hf-kicker-lime">Who we sign</p>
                <h2 className="hf-h2-light">No exceptions. Owners are letting us into their houses.</h2>
                <ul className="hf-founding-list">
                  <li><strong>Public liability insurance</strong> in your own name, with the certificate of currency uploaded to your profile. No certificate, no jobs.</li>
                  <li><strong>Your trade licence</strong> on the public register and in date, for plumbing, gas and electrical work.</li>
                  <li><strong>A Ministry of Justice criminal record check.</strong> You request your own copy, free, about a week.</li>
                  <li><strong>You turn up when you said.</strong> On time, on the days you've ticked. That's the whole deal.</li>
                </ul>
              </div>
              <div className="hf-founding-cta">
                <p className="hf-big-price">
                  $0<span>to join, ever</span>
                </p>
                <a href="#handup" className="hf-btn hf-btn-lime hf-btn-full">
                  Put my hand up <Arrow />
                </a>
                <p className="hf-fine hf-fine-light">Queenstown first. Your town opens when the trades are covered, and the first to put their hands up are first choice.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hf-section">
          <div className="hf-wrap hf-faq-wrap">
            <div>
              <p className="hf-kicker">Straight answers</p>
              <h2 className="hf-h2">The questions tradies actually ask.</h2>
            </div>
            <div className="hf-faq">
              {FAQS.map(([question, answer]) => (
                <details key={question} className="hf-faq-item">
                  <summary>
                    {question}
                    <span className="hf-plus" aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="hf-section hf-final">
          <div className="hf-wrap hf-final-inner">
            <h2 className="hf-h2-light">Steady small jobs, paid without a phone call.</h2>
            <p>Reply with your trade and town, send a photo of your certificate, and Joe rings you for 10 minutes.</p>
            <div className="hf-final-cta">
              <a href="#handup" className="hf-btn hf-btn-lime">
                Put my hand up <Arrow />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="hf-footer">
        <div className="hf-wrap hf-footer-row">
          <Logo small />
          <span>Questions? hello@leadhivenz.com</span>
        </div>
      </footer>
    </div>
  );
}

type Errors = Partial<Record<"name" | "phone" | "email" | "trade" | "town" | "insured", string>>;

function HandUpForm({ saveLead, onDone }: { saveLead: Props["saveLead"]; onDone: () => void }) {
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    const name = get("name");
    const phone = get("phone");
    const email = get("email");
    const trade = get("trade");
    const town = get("town");
    const insured = get("insured");
    const next: Errors = {};
    if (name.length < 2) next.name = "Please enter your name.";
    if (phone.replace(/\D/g, "").length < 8 || !/^[0-9+()\s-]+$/.test(phone)) next.phone = "Please check your mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please check your email.";
    if (!TRADES.some(([key]) => key === trade)) next.trade = "Pick your trade.";
    if (town.length < 2) next.town = "Which town?";
    if (insured !== "yes" && insured !== "not_yet") next.insured = "Pick one.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const query = new URLSearchParams(window.location.search);
    const param = (key: string, max = 255) => query.get(key)?.slice(0, max) || null;
    setSending(true);
    setFailed(false);
    const result = await saveLead({
      name: name.slice(0, 100),
      phone: phone.slice(0, 30),
      email: email.slice(0, 255),
      trade,
      town: town.slice(0, 100),
      insured,
      licence: get("licence").slice(0, 60) || null,
      message: get("message").slice(0, 500) || null,
      utm_source: param("utm_source"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
    }).catch(() => ({ ok: false }));
    setSending(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onDone();
  }

  return (
    <form id="handup" className="hf-card hf-form" onSubmit={submit} noValidate>
      <p className="hf-form-title">Put my hand up</p>
      <p className="hf-form-sub">A minute. Joe rings you, no obligation either way.</p>
      <Field id="name" label="Your name" error={errors.name}>
        <input id="name" name="name" autoComplete="name" maxLength={100} className="hf-input" />
      </Field>
      <Field id="phone" label="Mobile number" error={errors.phone}>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="hf-input" />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={255} className="hf-input" />
      </Field>
      <fieldset className={`hf-field hf-choices ${errors.trade ? "hf-field-error" : ""}`}>
        <legend className="hf-label">Your trade</legend>
        <div className="hf-chips">
          {TRADES.map(([key, label]) => (
            <label key={key} className="hf-chip">
              <input type="radio" name="trade" value={key} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.trade && <span className="hf-error">{errors.trade}</span>}
      </fieldset>
      <Field id="town" label="Town you cover" error={errors.town}>
        <input id="town" name="town" maxLength={100} placeholder="e.g. Queenstown" autoComplete="address-level2" className="hf-input" />
      </Field>
      <fieldset className={`hf-field hf-choices ${errors.insured ? "hf-field-error" : ""}`}>
        <legend className="hf-label">Public liability insurance in your name?</legend>
        <div className="hf-chips">
          <label className="hf-chip">
            <input type="radio" name="insured" value="yes" />
            <span>Yes, I have it</span>
          </label>
          <label className="hf-chip">
            <input type="radio" name="insured" value="not_yet" />
            <span>Not yet</span>
          </label>
        </div>
        {errors.insured && <span className="hf-error">{errors.insured}</span>}
      </fieldset>
      <Field id="licence" label="Licence number (if your trade has one)">
        <input id="licence" name="licence" maxLength={60} className="hf-input" />
      </Field>
      <Field id="message" label="Anything else (optional)">
        <input id="message" name="message" maxLength={500} placeholder="Days you work, other towns, questions" className="hf-input" />
      </Field>
      {failed && <p className="hf-error-box">That didn't send. Please check your connection and try again.</p>}
      <button type="submit" className="hf-btn hf-btn-lime hf-btn-full" disabled={sending}>
        {sending ? "Sending…" : "Put my hand up"}
        {!sending && <Arrow />}
      </button>
      <p className="hf-fine">Free to join. Nothing to pay, ever. No spam.</p>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className={`hf-field ${error ? "hf-field-error" : ""}`} htmlFor={id}>
      <span className="hf-label">{label}</span>
      {children}
      {error && <span className="hf-error">{error}</span>}
    </label>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`hf-logo ${small ? "hf-logo-small" : ""}`}>
      <svg width="20" height="26" viewBox="0 0 20 26" aria-hidden="true">
        <rect width="20" height="26" rx="3.5" className="hf-fill-plum" />
        <path d="M14 2.5 19 1v24l-5-1.5z" className="hf-fill-lime" />
        <circle cx="11" cy="14" r="1.5" className="hf-fill-lime" />
      </svg>
      HostFix
    </span>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
