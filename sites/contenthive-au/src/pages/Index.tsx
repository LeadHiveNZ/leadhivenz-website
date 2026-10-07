import { SiTiktok, SiInstagram, SiFacebook, SiYoutube } from "react-icons/si";
import type { ReactNode } from "react";
import markAsset from "@/assets/contenthive-mark.png.asset.json";
import EnquiryForm from "@/components/EnquiryForm";

/* ------------------------------------------------------------------
   ContentHive — done-for-you social content for trade businesses.
   Brand: black + amber, but the page now breathes: cream sections,
   phone mockups, a weekly posting calendar, proof, FAQ, and a clear
   Melbourne / AU + NZ footprint for search.
------------------------------------------------------------------- */

const AMBER = "#F8BF17";
const INK = "#0B0B0B";
const CREAM = "#F6F1E7";
const CREAM_2 = "#EEE6D6";
const HEX = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";
const head = { fontFamily: "Poppins, sans-serif", letterSpacing: "-0.025em", lineHeight: 1.04 } as const;
const label = { fontFamily: "Poppins, sans-serif", fontWeight: 700, letterSpacing: "0.18em" } as const;

function Hex({ size = 10, color = AMBER, children, className = "" }: { size?: number; color?: string; children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size, background: color, clipPath: HEX }}>
      {children}
    </span>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-3" aria-label="ContentHive home">
      <img src={markAsset.url} alt="ContentHive logo" className="h-9 w-auto" width={460} height={530} />
      <span className="text-[15px]" style={{ ...label, fontWeight: 700 }}>
        <span style={{ color: dark ? INK : "#fff" }}>CONTENT</span>
        <span style={{ color: AMBER }}>HIVE</span>
      </span>
    </a>
  );
}

function Eyebrow({ children, color = AMBER }: { children: ReactNode; color?: string }) {
  return (
    <p className="flex items-center gap-2 text-[12px] uppercase" style={{ ...label, color }}>
      <Hex size={9} color={color} />
      {children}
    </p>
  );
}

function BtnPrimary({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <a
      href="#book"
      className={`inline-block rounded-sm px-6 py-3.5 text-[13px] uppercase transition-transform hover:-translate-y-0.5 ${className}`}
      style={{ background: dark ? INK : AMBER, color: dark ? AMBER : INK, ...label, letterSpacing: "0.08em", boxShadow: "0 12px 30px rgba(248,191,23,0.25)" }}
    >
      {children}
    </a>
  );
}

function BtnSecondary({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <a
      href={href}
      className="inline-block rounded-sm px-6 py-3.5 text-[13px] uppercase transition-colors"
      style={{ border: `1.5px solid ${dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.28)"}`, color: dark ? INK : "#fff", ...label, letterSpacing: "0.08em" }}
    >
      {children}
    </a>
  );
}

const Wrap = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1140px] px-5 ${className}`}>{children}</div>
);

/* ---------- a CSS-only phone showing a "reel" so the page has visuals without stock photos ---------- */
function Phone({ title, sub, tag, tilt = 0, tone = "#1a1a1a" }: { title: string; sub: string; tag: string; tilt?: number; tone?: string }) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: 200, height: 410, borderRadius: 34, background: "#111", border: "8px solid #1f1f1f", boxShadow: "0 40px 80px rgba(0,0,0,0.45)", transform: `rotate(${tilt}deg)` }}
    >
      <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full" style={{ background: "#1f1f1f" }} />
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 26, background: `linear-gradient(180deg, ${tone} 0%, #090909 100%)` }}>
        <div className="absolute inset-x-0 top-0 h-1/2 opacity-60" style={{ background: "radial-gradient(circle at 30% 20%, rgba(248,191,23,0.35), transparent 55%)" }} />
        <span className="absolute left-3 top-9 rounded-sm px-2 py-1 text-[10px] uppercase" style={{ background: AMBER, color: INK, ...label }}>
          {tag}
        </span>
        <div className="absolute bottom-16 left-3 right-3">
          <p className="text-[17px] leading-tight text-white" style={{ ...head, fontWeight: 800 }}>
            {title}
          </p>
          <p className="mt-2 text-[12px]" style={{ color: "#B8B8B8" }}>
            {sub}
          </p>
        </div>
        <div className="absolute bottom-4 left-3 right-3 flex items-center justify-between text-[10px]" style={{ color: "#B8B8B8" }}>
          <span>♡ 1.2k</span>
          <span>💬 48</span>
          <span>↗ 310</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: AMBER, width: "62%" }} />
      </div>
    </div>
  );
}

const steps = [
  { n: "01", t: "FILM", b: "Two sessions a month, roughly five hours each, on your site in Melbourne. We work around the job, not the other way round." },
  { n: "02", t: "EDIT", b: "Every session becomes reels, stills and posts, sized and captioned for four platforms. Videography, photography and editing all included." },
  { n: "03", t: "POST", b: "Live every business day, Monday to Friday. You don't touch a scheduler, write a caption or think about it once." },
];

const platforms = [
  { Icon: SiTiktok, name: "TikTok", color: "#69C9D0" },
  { Icon: SiInstagram, name: "Instagram", color: "#E4405F" },
  { Icon: SiFacebook, name: "Facebook", color: "#1877F2" },
  { Icon: SiYoutube, name: "YouTube Shorts", color: "#FF0000" },
];

const week = [
  { d: "Mon", t: "Before & after", k: "Reel" },
  { d: "Tue", t: "Job of the day", k: "Story + post" },
  { d: "Wed", t: "Tip from the van", k: "Reel" },
  { d: "Thu", t: "Meet the crew", k: "Carousel" },
  { d: "Fri", t: "Finished work", k: "Reel + photo" },
];

const included = [
  "6 filming sessions across 90 days",
  "Videography, photography and editing included",
  "Content live every business day",
  "Monthly brand strategy and review call",
  "Cut for TikTok, Instagram, Facebook and YouTube Shorts",
  "No lock-in contract",
];

const trust = [
  { t: "Month to month", b: "You stay because it's working, not because you signed something in January." },
  { t: "We redo it if it misses", b: "If the content misses the mark, we recut it. No argument, no change fee." },
  { t: "Reviewed every month", b: "One call a month on what's landing, what's not and where we point the camera next." },
];

const faqs = [
  { q: "Where do you film?", a: "Across Melbourne and surrounds: the eastern and south-eastern suburbs, the Mornington Peninsula, Geelong and the growth corridors. We're Melbourne based. For trade businesses in New Zealand we work through our sister company LeadHive NZ." },
  { q: "What trades is this for?", a: "Plumbers, electricians, HVAC and heating and cooling, roofers, builders, landscapers and other owner-operator trade businesses that do visible work on site. If your job looks good on camera, it works." },
  { q: "Do I have to be on camera?", a: "A little. Faces build trust and the videos with the owner in them do best. But most of the content is the work itself: before and afters, the van, the crew, the finished job. We make it painless." },
  { q: "How much does it cost?", a: "It's a 90 day partnership, priced as a monthly fee with everything included: filming, editing, posting and the monthly review. The first three Melbourne clients get the foundation partner rate. We walk through the numbers on the call, then you decide." },
  { q: "Do you run paid ads too?", a: "Not as part of this. ContentHive is organic content: the feed that makes people trust you before they ring. If you want paid Google Ads leads as well, that's what LeadHive does." },
  { q: "Who's behind ContentHive?", a: "Joe Ingram. He grew a hospitality brand to 15,000 followers from scratch, runs LeadHive NZ, a lead generation agency with trade partners across New Zealand, and started ContentHive because the tradies he works with kept asking who could run their socials properly." },
];

export default function Index() {
  return (
    <div id="top" className="min-h-screen" style={{ background: INK, fontFamily: "Barlow, sans-serif", color: "#FFFFFF" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur" style={{ background: "rgba(11,11,11,0.9)", borderBottom: "1px solid #1c1c1c" }}>
        <Wrap className="flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-6" aria-label="Main">
            <a href="#how" className="hidden text-[13px] uppercase md:inline" style={{ color: "#B8B8B8" }}>How it works</a>
            <a href="#week" className="hidden text-[13px] uppercase md:inline" style={{ color: "#B8B8B8" }}>What you get</a>
            <a href="#faq" className="hidden text-[13px] uppercase md:inline" style={{ color: "#B8B8B8" }}>FAQ</a>
            <BtnPrimary className="!px-5 !py-2.5">Book a call</BtnPrimary>
          </nav>
        </Wrap>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ backgroundImage: "linear-gradient(to right,#141414 1px,transparent 1px),linear-gradient(to bottom,#141414 1px,transparent 1px)", backgroundSize: "64px 64px" }}>
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(248,191,23,0.22), transparent 65%)" }} />
        <Wrap className="relative grid items-center gap-12 py-[72px] md:grid-cols-[1.1fr_0.9fr] md:py-[96px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-sm px-4 py-2 text-[12px] uppercase" style={{ border: "1px solid #2a2a2a", letterSpacing: "0.16em", color: "#B8B8B8" }}>
              <Hex size={9} />
              Done-for-you social content · Melbourne trades · AU &amp; NZ
            </div>
            <h1 className="mt-8 max-w-[14ch]" style={{ ...head, fontWeight: 800, fontSize: "clamp(40px,7vw,80px)" }}>
              <span className="text-white">Your work is good.</span>{" "}
              <span style={{ color: AMBER }}>Your socials should show it.</span>
            </h1>
            <p className="mt-7 max-w-[54ch] text-[18px]" style={{ color: "#C9C9C9" }}>
              We film on your site in Melbourne, cut it into reels and posts for four platforms, and
              post every business day. You keep working. Your page keeps selling, and the next
              customer already trusts you before they call.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <BtnPrimary>Book a 15 minute call</BtnPrimary>
              <BtnSecondary href="#how">See how it works</BtnSecondary>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
              {["No lock-in", "Posted Mon–Fri", "Built for trades", "We film, edit & post"].map((i) => (
                <li key={i} className="flex items-center gap-2 text-[12px] uppercase" style={{ letterSpacing: "0.14em", color: "#B8B8B8" }}>
                  <Hex size={9} />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-end justify-center gap-[-20px] md:justify-end" aria-hidden="true">
            <div className="flex items-end" style={{ gap: 0 }}>
              <div style={{ marginRight: -36, zIndex: 1 }}>
                <Phone tag="Before / after" title="Switchboard, 1976 to today" sub="Bayside sparky · 41s" tilt={-8} tone="#1d1a12" />
              </div>
              <div style={{ zIndex: 3 }}>
                <Phone tag="Reel" title="Hot water swap in 90 mins" sub="Eastern suburbs plumber · 28s" tone="#1a1a1a" />
              </div>
              <div className="hidden lg:block" style={{ marginLeft: -36, zIndex: 2 }}>
                <Phone tag="Meet the crew" title="Who turns up at your door" sub="Peninsula heating & cooling · 34s" tilt={8} tone="#14171d" />
              </div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Amber strip */}
      <div style={{ background: AMBER }}>
        <Wrap className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4">
          {["Plumbers", "Electricians", "Heating & cooling", "Roofers", "Builders", "Landscapers", "Owner-operators"].map((t, i) => (
            <span key={t} className="flex items-center gap-3">
              {i > 0 && <span style={{ color: "rgba(0,0,0,0.45)" }}>/</span>}
              <span className="text-[13px] uppercase" style={{ color: INK, ...label, letterSpacing: "0.14em" }}>{t}</span>
            </span>
          ))}
        </Wrap>
      </div>

      {/* Problem, on cream so the page breathes */}
      <section style={{ background: CREAM, color: INK }}>
        <Wrap className="grid gap-12 py-[80px] md:grid-cols-2">
          <div>
            <Eyebrow color={INK}>The problem</Eyebrow>
            <h2 className="mt-5 text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
              You're too busy running the business to market it.
            </h2>
            <p className="mt-6 text-[17px]" style={{ color: "#3a3a3a" }}>
              Every owner-operator says the same thing. The jobs come first. Posting comes last, then
              never. Six weeks later the page is dead and the phone is quieter than it should be.
            </p>
            <p className="mt-4 text-[17px]" style={{ color: "#3a3a3a" }}>
              Meanwhile the customer checking you out at 9pm sees a logo, three photos from 2023 and
              no sign anyone's home.
            </p>
          </div>
          <div className="grid gap-4">
            {[
              { t: "Dead page", b: "A page that hasn't posted in months tells a customer you might not be around. That doubt costs you the job before you quote it." },
              { t: "DIY posting", b: "Phone footage in the ute at 8pm, three posts in a week, then nothing for a month. Inconsistent beats nothing, but it doesn't build anything." },
              { t: "The 'social media manager'", b: "Stock photos and quotes about teamwork. Nobody hires a plumber because of a sunset with a motivational line on it." },
            ].map((c) => (
              <div key={c.t} className="rounded-md p-7" style={{ background: "#fff", borderLeft: `4px solid ${AMBER}`, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
                <h3 className="text-[24px]" style={{ ...head, fontWeight: 800 }}>{c.t}</h3>
                <p className="mt-3 text-[16px]" style={{ color: "#3a3a3a" }}>{c.b}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* How it works */}
      <section id="how">
        <Wrap className="py-[80px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 max-w-[20ch] text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
            Three steps. We handle all of them.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-md p-7" style={{ background: "#141414", borderTop: `3px solid ${AMBER}` }}>
                <div className="flex items-center gap-3">
                  <Hex size={38}>
                    <span className="text-[13px]" style={{ color: INK, ...label, fontWeight: 800 }}>{s.n}</span>
                  </Hex>
                  <h3 className="text-[20px] uppercase" style={{ ...head, fontWeight: 800, letterSpacing: "0.06em" }}>{s.t}</h3>
                </div>
                <p className="mt-4 text-[16px]" style={{ color: "#B8B8B8" }}>{s.b}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* A week on your feed, cream again */}
      <section id="week" style={{ background: CREAM_2, color: INK }}>
        <Wrap className="py-[80px]">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              <Eyebrow color={INK}>What a week looks like</Eyebrow>
              <h2 className="mt-5 text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
                Five posts. Every week. Without you lifting a finger.
              </h2>
            </div>
            <p className="text-[17px]" style={{ color: "#3a3a3a" }}>
              One shoot gives us a fortnight of content. We plan it so your feed shows the full
              picture: the work, the people, the proof. Here's a typical week for a Melbourne plumber.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-5">
            {week.map((w, i) => (
              <div key={w.d} className="rounded-md p-5" style={{ background: i % 2 ? "#fff" : INK, color: i % 2 ? INK : "#fff" }}>
                <p className="text-[12px] uppercase" style={{ ...label, color: AMBER }}>{w.d}</p>
                <p className="mt-3 text-[20px] leading-tight" style={{ ...head, fontWeight: 800 }}>{w.t}</p>
                <p className="mt-2 text-[13px] uppercase" style={{ letterSpacing: "0.12em", color: i % 2 ? "#6a6a6a" : "#B8B8B8" }}>{w.k}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Why it matters + stats */}
      <section>
        <Wrap className="grid gap-12 py-[80px] md:grid-cols-2">
          <div>
            <Eyebrow>Why it matters</Eyebrow>
            <h2 className="mt-5 text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
              People buy from the trades they already follow.
            </h2>
            <p className="mt-6 text-[17px]" style={{ color: "#C9C9C9" }}>
              Your customers check your page before they call. A feed full of real jobs, real faces
              and finished work builds trust faster than any website can, because it shows the work
              happening rather than claiming it.
            </p>
            <p className="mt-4 text-[17px]" style={{ color: "#C9C9C9" }}>
              By the time they ring, they've already decided you're the one they want.
            </p>
          </div>
          <div className="rounded-md" style={{ border: "1px solid #2a2a2a" }}>
            {[
              { f: "4 platforms", c: "Same shoot, cut for each one" },
              { f: "Mon–Fri", c: "Content live every business day" },
              { f: "6 shoots", c: "Across the 90 days" },
            ].map((r, i) => (
              <div key={r.f} className="p-7" style={i > 0 ? { borderTop: "1px solid #1c1c1c" } : undefined}>
                <div style={{ ...head, fontWeight: 800, color: AMBER, fontSize: "clamp(32px,5vw,46px)" }}>{r.f}</div>
                <p className="mt-2 text-[15px]" style={{ color: "#B8B8B8" }}>{r.c}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Platforms */}
      <section>
        <Wrap className="pb-[80px]">
          <Eyebrow color="#B8B8B8">One shoot. Cut for four platforms.</Eyebrow>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4" style={{ background: "#1c1c1c", gap: 1 }}>
            {platforms.map(({ Icon, name, color }) => (
              <div key={name} className="flex flex-col items-center gap-4 px-4 py-10" style={{ background: "#141414" }}>
                <Icon size={44} color={color} />
                <span className="text-center text-[14px] uppercase text-white" style={{ ...label }}>{name}</span>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Included */}
      <section id="included" style={{ background: CREAM, color: INK }}>
        <Wrap className="py-[80px]">
          <Eyebrow color={INK}>What's included</Eyebrow>
          <h2 className="mt-5 max-w-[20ch] text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
            One partnership. Everything in it.
          </h2>
          <div className="mt-10 grid md:grid-cols-3" style={{ background: "#d8d0bf", gap: 1 }}>
            {included.map((i) => (
              <div key={i} className="flex items-start gap-3 p-7 text-[16px]" style={{ background: CREAM }}>
                <Hex size={10} className="mt-2" />
                <span>{i}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-6 rounded-md p-7 md:flex-row md:items-center md:justify-between" style={{ background: INK, color: "#fff" }}>
            <div>
              <p className="text-[22px]" style={{ ...head, fontWeight: 800 }}>Foundation partner rate, first 3 Melbourne clients only</p>
              <p className="mt-2 text-[16px]" style={{ color: "#B8B8B8" }}>We walk through the numbers on the call, then you decide.</p>
            </div>
            <BtnPrimary>Book a call</BtnPrimary>
          </div>
        </Wrap>
      </section>

      {/* Who's behind it */}
      <section>
        <Wrap className="grid gap-12 py-[80px] md:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Who you're dealing with</Eyebrow>
            <h2 className="mt-5 text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
              Built by someone who's grown a page from zero.
            </h2>
            <p className="mt-6 text-[17px]" style={{ color: "#C9C9C9" }}>
              ContentHive is run by Joe Ingram. He grew a hospitality brand to 15,000 followers with
              nothing but a phone and consistency, then built LeadHive NZ, a lead generation agency
              with trade partners from Northland to Christchurch. ContentHive exists because those
              tradies kept asking the same question: who can run my socials properly?
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
            {[
              { n: "15,000", l: "followers grown on one brand, from zero" },
              { n: "1,600+", l: "tracked enquiries delivered to trade businesses through LeadHive" },
              { n: "Mon–Fri", l: "posting cadence, every week of the partnership" },
            ].map((s) => (
              <div key={s.l} className="rounded-md p-6" style={{ background: "#141414", borderLeft: `3px solid ${AMBER}` }}>
                <div style={{ ...head, fontWeight: 800, fontSize: 38, color: AMBER }}>{s.n}</div>
                <p className="mt-1 text-[15px]" style={{ color: "#B8B8B8" }}>{s.l}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Trust model */}
      <section style={{ background: "#0f0f0f" }}>
        <Wrap className="py-[80px]">
          <Eyebrow>The trust model</Eyebrow>
          <h2 className="mt-5 max-w-[20ch]" style={{ ...head, fontWeight: 800, fontSize: "clamp(32px,5.6vw,60px)" }}>
            No 12-month contract. No lock-in. No excuses.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {trust.map((c) => (
              <div key={c.t} className="rounded-md p-7" style={{ background: "#141414" }}>
                <h3 className="text-[19px]" style={{ ...head, fontWeight: 700 }}>{c.t}</h3>
                <p className="mt-3 text-[16px]" style={{ color: "#B8B8B8" }}>{c.b}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: CREAM, color: INK }}>
        <Wrap className="grid gap-10 py-[80px] md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <Eyebrow color={INK}>Straight answers</Eyebrow>
            <h2 className="mt-5 text-[clamp(30px,4.6vw,46px)]" style={{ ...head, fontWeight: 800 }}>
              What tradies ask before they book.
            </h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((f, i) => (
              <details key={f.q} open={i === 0} className="group rounded-md" style={{ background: "#fff", border: "1px solid #e4dccb" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[18px]" style={{ ...head, fontWeight: 700 }}>
                  {f.q}
                  <span className="shrink-0 text-[22px] transition-transform group-open:rotate-45" style={{ color: AMBER }}>+</span>
                </summary>
                <p className="px-6 pb-6 text-[16px]" style={{ color: "#3a3a3a" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Book */}
      <section id="book" style={{ background: AMBER, color: INK }}>
        <Wrap className="py-[90px]">
          <div className="flex items-center gap-2 text-[12px] uppercase" style={{ ...label, letterSpacing: "0.2em" }}>
            <Hex size={9} color={INK} />
            Plug in. Shoot. Grow.
          </div>
          <h2 className="mt-6 max-w-[18ch]" style={{ ...head, fontWeight: 800, fontSize: "clamp(34px,6.4vw,68px)" }}>
            Three Melbourne spots at the foundation rate. Then it goes up.
          </h2>
          <p className="mt-6 max-w-[52ch] text-[19px]" style={{ color: "rgba(0,0,0,0.75)" }}>
            Fifteen minutes on the phone. We'll tell you straight whether this fits your business.
          </p>
          <div className="mt-9 max-w-[720px]">
            <EnquiryForm />
          </div>
        </Wrap>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1c1c1c" }}>
        <Wrap className="grid gap-8 py-12 pb-28 md:grid-cols-[1.2fr_1fr_1fr] md:pb-12">
          <div>
            <Logo />
            <p className="mt-4 max-w-[40ch] text-[14px]" style={{ color: "#B8B8B8" }}>
              Done-for-you social media content for trade businesses. Melbourne based, working across
              Australia, and New Zealand through LeadHive NZ.
            </p>
          </div>
          <div className="text-[14px]" style={{ color: "#B8B8B8" }}>
            <p className="text-[12px] uppercase text-white" style={label}>Service areas</p>
            <p className="mt-3">Melbourne · Eastern suburbs · South-east · Bayside · Mornington Peninsula · Geelong · Growth corridors</p>
          </div>
          <div className="text-[14px]" style={{ color: "#B8B8B8" }}>
            <p className="text-[12px] uppercase text-white" style={label}>Contact</p>
            <p className="mt-3"><a href="mailto:hello@leadhivenz.com" style={{ color: AMBER }}>hello@leadhivenz.com</a></p>
            <p className="mt-2"><a href="https://leadhivenz.co" style={{ color: "#B8B8B8" }}>LeadHive NZ, our lead generation sister company</a></p>
          </div>
        </Wrap>
      </footer>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur md:hidden" style={{ background: "rgba(11,11,11,0.94)", borderTop: "1px solid #1c1c1c" }}>
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <span className="text-[14px]" style={{ ...label }}>First 3 clients only</span>
          <BtnPrimary className="!px-5 !py-2.5">Book a call</BtnPrimary>
        </div>
      </div>
    </div>
  );
}
