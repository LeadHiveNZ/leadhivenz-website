import { useEffect, useRef, useState, type FormEvent } from "react";

/**
 * HostFix owner landing page (free to join).
 * Flow: the ad brings an owner here -> they leave their details -> the page unlocks
 * the 2-minute Loom, the deal (free to join, fixed prices), prices and answers.
 * Nothing is sold on this page: the next step is a phone call.
 *
 * Change this line only:
 */
export const LOOM_EMBED_URL = "https://www.loom.com/embed/57e1c68fba1c472aa84bff7c41da6766";

const UNLOCK_KEY = "hostfix_lead_submitted";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
  }
}

/** Tells the Meta pixel a lead was saved, once, only when the pixel is on the page. */
function trackLead() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "Lead", { content_name: "HostFix owner lead", value: 0, currency: "NZD" });
}

export type Lead = {
  name: string;
  phone: string;
  email: string;
  properties: number;
  /** owner, manager or cohost */
  role: string;
  town: string;
  /** who sorts their maintenance today */
  who_now: string | null;
  /** when to ring them */
  call_time: string | null;
  suburb: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  fbclid: string | null;
};

type Props = { saveLead: (lead: Lead) => Promise<{ ok: boolean }> };

export function HostFixLanding({ saveLead }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const videoRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* private browsing: just show the form */
    }
  }, []);

  function unlock() {
    try {
      localStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
    setTimeout(() => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <div className="hf">
      <header className="hf-hero">
        <div className="hf-wrap">
          <nav className="hf-nav">
            <Logo />
            <span className="hf-pill">
              <span className="hf-dot" /> New Zealand
            </span>
          </nav>

          <div className="hf-hero-grid">
            <div className="hf-hero-copy">
              <p className="hf-eyebrow">For Airbnb and holiday home owners</p>
              <h1 className="hf-h1">
                Never ring round for a <span className="hf-mark">tradie</span> again.
              </h1>
              <p className="hf-lead">
                Tap what's broken, see the fixed price, and a checked local handyman, sparky or plumber is on site within
                24 hours. Free to join. Opening town by town across New Zealand. Leave your details to watch how it works.
              </p>
              <ul className="hf-ticks">
                <li>Free to join. No monthly fee</li>
                <li>Fixed prices, GST in. Pay only when it's fixed</li>
                <li>Your cleaner and guests can report it</li>
              </ul>
            </div>

            <div className="hf-hero-form">
              {unlocked ? (
                <div className="hf-card hf-done">
                  <p className="hf-done-title">You're in.</p>
                  <p>Watch the 2-minute video below. We'll give you a quick call to set you up. It's free.</p>
                  <button type="button" className="hf-btn hf-btn-plum" onClick={() => videoRef.current?.scrollIntoView({ behavior: "smooth" })}>
                    Watch the video
                  </button>
                </div>
              ) : (
                <LeadForm saveLead={saveLead} onDone={unlock} />
              )}
            </div>
          </div>
        </div>
      </header>

      {unlocked ? (
        <Unlocked videoRef={videoRef} />
      ) : (
        <section className="hf-locked" aria-label="Locked until you leave your details">
          <div className="hf-wrap">
            <div className="hf-locked-blur" aria-hidden="true">
              <div className="hf-video-frame hf-video-fake">
                <span className="hf-play" />
              </div>
              <div className="hf-founding hf-founding-fake">
                <p className="hf-h2-light">Free to join. Opening town by town across New Zealand.</p>
              </div>
            </div>
            <div className="hf-lock-note">
              <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
                <path d="M3 7V5a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1Zm2 0h4V5a2 2 0 1 0-4 0v2Z" />
              </svg>
              Leave your details above to watch the video and see every price
            </div>
          </div>
        </section>
      )}

      <footer className="hf-footer">
        <div className="hf-wrap hf-footer-row">
          <Logo small />
          <span>New Zealand · Questions? We'll call you.</span>
        </div>
      </footer>
    </div>
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

type Errors = Partial<Record<"name" | "phone" | "email" | "properties" | "role" | "town", string>>;

const ROLES: [string, string][] = [
  ["owner", "I own it"],
  ["manager", "I manage for owners"],
  ["cohost", "I co-host or clean"],
];
const WHO_NOW: [string, string][] = [
  ["", "Who sorts it?"],
  ["me", "Me, ringing round"],
  ["manager", "My property manager"],
  ["handyman", "A handyman I know"],
  ["nobody", "Nobody. It piles up"],
];
const CALL_TIMES: [string, string][] = [
  ["", "Best time?"],
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "After 6pm"],
  ["text", "Text me first"],
];

function LeadForm({ saveLead, onDone }: { saveLead: Props["saveLead"]; onDone: () => void }) {
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
    const properties = Number(get("properties"));
    const role = get("role");
    const town = get("town");
    const next: Errors = {};
    if (name.length < 2) next.name = "Please enter your name.";
    if (!ROLES.some(([key]) => key === role)) next.role = "Pick one.";
    if (town.length < 2) next.town = "Which town?";
    if (phone.replace(/\D/g, "").length < 8 || !/^[0-9+()\s-]+$/.test(phone)) next.phone = "Please check your mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please check your email.";
    if (!Number.isInteger(properties) || properties < 1 || properties > 500) next.properties = "How many?";
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
      properties,
      role,
      town: town.slice(0, 100),
      who_now: get("who_now").slice(0, 40) || null,
      call_time: get("call_time").slice(0, 40) || null,
      suburb: null,
      utm_source: param("utm_source"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
      fbclid: param("fbclid", 500),
    }).catch(() => ({ ok: false }));
    setSending(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    trackLead();
    onDone();
  }

  return (
    <form className="hf-card hf-form" onSubmit={submit} noValidate>
      <p className="hf-form-title">Watch how it works</p>
      <p className="hf-form-sub">2-minute video. Takes 20 seconds to unlock.</p>
      <Field id="name" label="Your name" error={errors.name}>
        <input id="name" name="name" autoComplete="name" maxLength={100} className="hf-input" />
      </Field>
      <Field id="phone" label="Mobile number" error={errors.phone}>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="hf-input" />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={255} className="hf-input" />
      </Field>
      <fieldset className={`hf-field hf-choices ${errors.role ? "hf-field-error" : ""}`}>
        <legend className="hf-label">The property</legend>
        <div className="hf-chips">
          {ROLES.map(([key, label]) => (
            <label key={key} className="hf-chip">
              <input type="radio" name="role" value={key} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.role && <span className="hf-error">{errors.role}</span>}
      </fieldset>
      <div className="hf-row">
        <Field id="properties" label="How many" error={errors.properties}>
          <input id="properties" name="properties" type="number" inputMode="numeric" min={1} max={500} defaultValue={1} className="hf-input" />
        </Field>
        <Field id="town" label="Town" error={errors.town}>
          <input id="town" name="town" maxLength={100} placeholder="e.g. Queenstown" autoComplete="address-level2" className="hf-input" />
        </Field>
      </div>
      <div className="hf-row">
        <Field id="who_now" label="Repairs today">
          <select id="who_now" name="who_now" className="hf-input" defaultValue="">
            {WHO_NOW.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>
        <Field id="call_time" label="Call you">
          <select id="call_time" name="call_time" className="hf-input" defaultValue="">
            {CALL_TIMES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>
      </div>
      {failed && <p className="hf-error-box">That didn't send. Please check your connection and try again.</p>}
      <button type="submit" className="hf-btn hf-btn-lime hf-btn-full" disabled={sending}>
        {sending ? "Unlocking…" : "Watch how it works"}
        {!sending && <Arrow />}
      </button>
      <p className="hf-fine">Free to join. We'll give you a quick call. No spam, ever.</p>
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

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS: [string, string][] = [
  ["Anyone can report it", "You, your cleaner from a link on their phone, or your guest from a QR card in the house. A photo and a minute."],
  ["We find the tradie, not you", "It goes to our first-choice local tradie for that trade. If they can't take it, it moves to the next one. You get a text at each step."],
  ["They get in without you", "Your lockbox code is only shown to the tradie who accepts the job."],
  ["Photos and a fixed price", "Your card is charged the menu price when the job is done. Nothing before that. One statement a month."],
];

const PRICES: [string, number][] = [
  ["Blocked toilet, sink or shower drain", 245],
  ["Dripping tap or tap washer", 235],
  ["Running toilet or cistern repair", 235],
  ["Shower head or mixer replace", 235],
  ["No hot water, first-hour diagnosis", 235],
  ["Heat pump fault diagnosis", 245],
  ["Power point or light switch replace", 225],
  ["Tripping circuit, first-hour diagnosis", 225],
  ["Reseal a shower or bath", 270],
  ["Lockout, business hours", 175],
  ["Light bulbs, up to 5", 165],
  ["Door handle, latch or lock adjust", 165],
];

const FAQS: [string, string][] = [
  ["I already have a guy.", "Keep him. We're who you call when he doesn't pick up on a Saturday in July."],
  ["What does it cost to join?", "Nothing. No joining fee, no monthly fee, no minimum. You add your property and a card, and the card is only charged the fixed price when a job is done."],
  ["So how do you make money?", "A small margin inside each fixed price. You pay the menu price and nothing more. The tradie gets steady work without quoting; you get a fixed price without chasing."],
  ["Are jobs dearer through you?", "No. Prices are set from what local tradies in your town charge for a call-out and the first hour, and the call-out is included."],
  ["Who are your tradies?", "Local tradies we've checked and approved, each with their own public liability insurance on file. Plumbing, gas and electrical work only goes to a tradie whose licence is on file and in date."],
  ["What if the tradie is late?", "When a tradie takes your job, they give you an arrival time: within 24 hours, or 4 when it's urgent. Paid the $50 for urgent and they're late? You don't pay it. If nobody can take your job, we tell you straight away and you pay nothing."],
  ["When do you start?", "Queenstown first, then town by town as insured local tradies sign up. Leave your town and we'll tell you the day it opens. The first 25 properties in each town are set up personally."],
  ["What if I change my mind?", "Nothing to cancel and nothing to refund, because you haven't paid anything. Remove your property any time."],
  ["I'm not in Queenstown.", "Leave your details with your town. That's how we pick the next towns to open, and the first owners in each one are set up personally."],
];

function Unlocked({ videoRef }: { videoRef: React.RefObject<HTMLElement | null> }) {
  return (
    <main>
      <section className="hf-section hf-video-section" ref={videoRef}>
        <div className="hf-wrap">
          <p className="hf-kicker">Step 1 · Watch</p>
          <h2 className="hf-h2">How HostFix works, in 2 minutes</h2>
          <div className="hf-video-frame">
            <iframe src={LOOM_EMBED_URL} title="How HostFix works" allow="fullscreen" allowFullScreen loading="lazy" />
          </div>
        </div>
      </section>

      <section className="hf-section">
        <div className="hf-wrap">
          <div className="hf-founding">
            <div>
              <p className="hf-kicker hf-kicker-lime">Step 2 · We call you</p>
              <h2 className="hf-h2-light">Free to join. Opening town by town across New Zealand.</h2>
              <ul className="hf-founding-list">
                <li><strong>$0 to join.</strong> No monthly fee, no minimum, no contract</li>
                <li><strong>Fixed prices</strong> you see before you say yes, GST included</li>
                <li>Your card is charged <strong>only when a job is done</strong></li>
                <li><strong>On site within 24 hours</strong>, or 4 when it's urgent, at a time the tradie gives you. Late on an urgent job? You don't pay the $50</li>
                <li>The first 25 properties in each town are <strong>set up personally</strong>: we call you, add your property, and you're covered</li>
              </ul>
            </div>
            <div className="hf-founding-cta">
              <p className="hf-big-price">
                $0<span>to join</span>
              </p>
              <p className="hf-fine hf-fine-light">You've left your details and your town. We'll call you, and tell you the day your town opens. No card needed until then.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hf-section">
        <div className="hf-wrap">
          <p className="hf-kicker">How it works</p>
          <h2 className="hf-h2">You tap once. We do the chasing.</h2>
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
        <div className="hf-wrap hf-price-grid">
          <div>
            <p className="hf-kicker">Prices</p>
            <h2 className="hf-h2">Fixed prices. GST included. No call-out fee on top.</h2>
            <div className="hf-member">
              <p className="hf-member-price">
                $0<span>/month. Free to join</span>
              </p>
              <p>
                You pay the fixed price when a job is done, and nothing else. A tradie on site within 24 hours, or 4 hours when it's
                urgent, at a time they give you when they take the job. Late on an urgent job and you don't pay the $50.
              </p>
            </div>
            <p className="hf-note">
              53 jobs on the full menu. The prices shown are Queenstown's; each town gets its own, set from what local tradies charge.
              Need someone there within 4 hours? Add $50. Outside 7am to 4:30pm weekdays, add $140. Small parts up to $30 are in the price; common parts have a fixed price on the list; anything else is the merchant's price plus 20% for sourcing it. Not on the menu? $225 for a
              tradie to come and look, then a quote. Nothing over $600 starts without your yes.
            </p>
          </div>
          <div className="hf-card hf-prices">
            {PRICES.map(([job, price]) => (
              <div key={job} className="hf-price-row">
                <span>{job}</span>
                <span className="hf-price">${price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hf-section">
        <div className="hf-wrap hf-split">
          <div className="hf-card hf-guest">
            <p className="hf-kicker">Guests</p>
            <h2 className="hf-h3">Your guests can report it too</h2>
            <p>
              A QR card in the house. Guests say what's wrong in a minute, never see a price, and nothing is sent until you say yes.
            </p>
          </div>
          <div className="hf-card hf-guest">
            <p className="hf-kicker">Your cleaner</p>
            <h2 className="hf-h3">Your cleaner gets their own link</h2>
            <p>They spot it between guests, snap a photo and send it. You get a text with the price, and a tradie is found straight away.</p>
          </div>
        </div>
      </section>

      <section className="hf-section">
        <div className="hf-wrap hf-faq-wrap">
          <div>
            <p className="hf-kicker">Questions</p>
            <h2 className="hf-h2">Fair questions.</h2>
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
          <h2 className="hf-h2-light">Free to join, anywhere in New Zealand.</h2>
          <p>Fixed prices. Pay only when it's fixed. Queenstown first, your town next. You've left your details, so expect a call from us.</p>
        </div>
      </section>
    </main>
  );
}
