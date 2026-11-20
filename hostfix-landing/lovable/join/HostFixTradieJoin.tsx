import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AGREEMENT_TEXT, DAYS, LICENSED_TRADES, TRADES, nzToday, validateSignup, type SignupErrors } from "@/lib/tradie-signup";

const RECORD_URL = "https://www.justice.govt.nz/criminal-records/get-your-own/";

/** Renders the agreement's simple markdown (## headings, - bullets, paragraphs) without changing its words. */
function Agreement() {
  const blocks = useMemo(() => {
    const out: ReactNode[] = [];
    let list: string[] = [];
    const flush = () => {
      if (list.length) out.push(<ul key={`ul${out.length}`}>{list.map((item, i) => <li key={i}>{item}</li>)}</ul>);
      list = [];
    };
    for (const raw of AGREEMENT_TEXT.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
      flush();
      if (line === "") continue;
      if (line.startsWith("## ")) out.push(<h4 key={out.length}>{line.slice(3)}</h4>);
      else if (line.startsWith("# ")) out.push(<h4 key={out.length}>{line.slice(2)}</h4>);
      else out.push(<p key={out.length}>{line}</p>);
    }
    flush();
    return out;
  }, []);
  return <div className="hf-agreement" tabIndex={0} aria-label="HostFix tradie agreement">{blocks}</div>;
}

export function HostFixTradieJoin({ onSigned }: { onSigned: () => void }) {
  const [errors, setErrors] = useState<SignupErrors>({});
  const [trades, setTrades] = useState<string[]>([]);
  const [gst, setGst] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState("");
  const today = nzToday();
  const todayLabel = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "long" }).format(new Date());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = (key: string) => {
      const v = form.get(key);
      if (!v || typeof v === "string" || v.size === 0) { form.delete(key); return null; }
      return v;
    };
    const insurance = file("insurance_file");
    const record = file("record_file");
    const query = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_campaign", "utm_content"]) {
      const v = query.get(k);
      if (v) form.set(k, v.slice(0, 255));
    }
    const result = validateSignup(form, { insurance, record }, today);
    if (!result.ok) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSending(true);
    setFailed("");
    try {
      const response = await fetch("/api/public/tradie-signups", { method: "POST", body: form });
      if (!response.ok) {
        setFailed(response.status === 413 ? "Those files are too big. Each one must be 10 MB or less." : response.status === 400 ? "Something in the form needs another look. Please check your details and documents." : "That didn't send. Please check your connection and try again.");
        setSending(false);
        return;
      }
      onSigned();
    } catch {
      setFailed("That didn't send. Please check your connection and try again.");
      setSending(false);
    }
  }

  const err = (key: string) => errors[key];
  const licensed = trades.filter((t) => LICENSED_TRADES.includes(t));

  return (
    <div className="hf">
      <header className="hf-wrap hf-join-head">
        <nav className="hf-nav">
          <Link to="/tradies" className="hf-logo-link"><Logo /></Link>
          <span className="hf-pill"><span className="hf-dot" /> Tradie sign-up</span>
        </nav>
        <p className="hf-kicker">Before launch</p>
        <h1 className="hf-h2">Lock in your spot.</h1>
        <p className="hf-note">About ten minutes. Have your insurance certificate and licence numbers handy.</p>
      </header>

      <main className="hf-wrap hf-join">
        <form className="hf-join-form" onSubmit={submit} noValidate>
          <Section n={1} title="About you">
            <Field name="full_name" label="Full name" error={err("full_name")}><input id="full_name" name="full_name" autoComplete="name" maxLength={100} className="hf-input" /></Field>
            <Field name="business_name" label="Business or trading name (optional)" error={err("business_name")}><input id="business_name" name="business_name" autoComplete="organization" maxLength={120} className="hf-input" /></Field>
            <Field name="phone" label="Mobile number" error={err("phone")}>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="hf-input" />
              <span className="hf-fine hf-fine-left">We'll text you about your sign-up and job offers. Reply STOP any time to opt out.</span>
            </Field>
            <Field name="email" label="Email" error={err("email")}><input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={255} className="hf-input" /></Field>
            <Field name="nzbn" label="NZBN (optional)" error={err("nzbn")}><input id="nzbn" name="nzbn" inputMode="numeric" maxLength={20} className="hf-input" /></Field>
            <Choices name="gst_registered" label="Are you GST registered?" error={err("gst_registered")}>
              <Chip type="radio" name="gst_registered" value="yes" label="Yes" onChange={() => setGst("yes")} />
              <Chip type="radio" name="gst_registered" value="no" label="No" onChange={() => setGst("no")} />
            </Choices>
            {gst === "yes" && (
              <Field name="gst_number" label="GST number" error={err("gst_number")}><input id="gst_number" name="gst_number" inputMode="numeric" maxLength={20} className="hf-input" /></Field>
            )}
          </Section>

          <Section n={2} title="Your work">
            <Choices name="trades" label="Your trades (pick all that apply)" error={err("trades")}>
              {TRADES.map(([key, label]) => (
                <Chip key={key} type="checkbox" name="trades" value={key} label={label}
                  onChange={(checked) => setTrades((prev) => (checked ? [...prev, key] : prev.filter((t) => t !== key)))} />
              ))}
            </Choices>
            <Field name="towns" label="Towns you cover" error={err("towns")}><input id="towns" name="towns" maxLength={200} placeholder="e.g. Queenstown, Arrowtown" className="hf-input" /></Field>
            <Choices name="work_days" label="Days you usually work (optional)" error={err("work_days")}>
              {DAYS.map((d) => <Chip key={d} type="checkbox" name="work_days" value={d} label={d} />)}
            </Choices>
          </Section>

          <Section n={3} title="Licences">
            {licensed.length === 0 && <p className="hf-fine hf-fine-left">Pick plumber, electrician or gasfitter above and we'll ask for that licence here.</p>}
            {licensed.map((t) => {
              const label = TRADES.find(([k]) => k === t)?.[1];
              return (
                <div key={t} className="hf-join-pair">
                  <Field name={`licence_number_${t}`} label={`${label} licence number`} error={err(`licence_number_${t}`)}><input id={`licence_number_${t}`} name={`licence_number_${t}`} maxLength={40} className="hf-input" /></Field>
                  <Field name={`licence_expiry_${t}`} label={`${label} licence expiry`} error={err(`licence_expiry_${t}`)}><input id={`licence_expiry_${t}`} name={`licence_expiry_${t}`} type="date" min={today} className="hf-input" /></Field>
                </div>
              );
            })}
            <Field name="lbp_number" label="LBP number (optional)" error={err("lbp_number")}><input id="lbp_number" name="lbp_number" maxLength={40} className="hf-input" /></Field>
          </Section>

          <Section n={4} title="Insurance">
            <p className="hf-fine hf-fine-left">Ask your insurer for a certificate of currency. No insurance, no jobs: that's the promise to owners.</p>
            <Field name="insurer" label="Insurer name" error={err("insurer")}><input id="insurer" name="insurer" maxLength={100} className="hf-input" /></Field>
            <Field name="policy_number" label="Policy number" error={err("policy_number")}><input id="policy_number" name="policy_number" maxLength={60} className="hf-input" /></Field>
            <Field name="insurance_expiry" label="Expiry date" error={err("insurance_expiry")}><input id="insurance_expiry" name="insurance_expiry" type="date" min={today} className="hf-input" /></Field>
            <Field name="insurance_file" label="Certificate of currency (PDF, JPG or PNG, max 10 MB)" error={err("insurance_file")}><input id="insurance_file" name="insurance_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hf-input hf-file" /></Field>
          </Section>

          <Section n={5} title="Criminal record check">
            <p className="hf-fine hf-fine-left"><a href={RECORD_URL} target="_blank" rel="noopener noreferrer" className="hf-join-link">Request yours free from the Ministry of Justice</a></p>
            <Field name="record_file" label="Upload your Ministry of Justice criminal record (PDF, JPG or PNG, max 10 MB)" error={err("record_file")}><input id="record_file" name="record_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hf-input hf-file" /></Field>
            <Check name="record_requested" label="Or: I've requested it and will send it before my first job" />
          </Section>

          <Section n={6} title="Your existing clients (optional)">
            <Field name="existing_clients" label="List any property owners or managers you already work for. They stay yours: HostFix never charges a fee to introduce them." error={err("existing_clients")}>
              <textarea id="existing_clients" name="existing_clients" maxLength={2000} rows={4} className="hf-input" />
            </Field>
          </Section>

          <Section n={7} title="The agreement">
            <p className="hf-join-intro">Read this before you sign. When the app launches you'll confirm it again in the app; nothing is charged to you, ever.</p>
            <h3 className="hf-h3">HostFix tradie agreement — version 21 November 2026</h3>
            <Agreement />
            <Check name="agree_terms" label="I have read and agree to the HostFix tradie agreement (21 November 2026)" error={err("agree_terms")} />
            <Check name="agree_contractor" label="I'm an independent contractor running my own business" error={err("agree_contractor")} />
            <Check name="agree_true" label="The details and documents I've given are true and current" error={err("agree_true")} />
            <Field name="signature_name" label="Type your full name as your signature" error={err("signature_name")}><input id="signature_name" name="signature_name" autoComplete="off" maxLength={100} className="hf-input hf-signature" /></Field>
            <p className="hf-fine hf-fine-left">Date: {todayLabel}</p>
          </Section>

          {failed && <p className="hf-error-box">{failed}</p>}
          {Object.keys(errors).length > 0 && <p className="hf-error-box">A few things need another look. They're marked in red above.</p>}
          <button type="submit" className="hf-btn hf-btn-lime hf-btn-full" disabled={sending}>{sending ? "Sending…" : "Sign and lock in my spot"}</button>
          <p className="hf-fine">Your documents are stored privately. Only the HostFix team can see them, and they're used only to check you can work in people's homes. Ask us any time to delete them.</p>
        </form>
      </main>

      <footer className="hf-footer">
        <div className="hf-wrap hf-footer-row">
          <Logo small />
          <span>Questions? hello@leadhivenz.com · <Link to="/privacy" className="hf-footer-link">Privacy</Link></span>
        </div>
      </footer>
    </div>
  );
}

export function HostFixTradieThanks() {
  return (
    <div className="hf">
      <main className="hf-wrap hf-join-head">
        <nav className="hf-nav"><Link to="/tradies" className="hf-logo-link"><Logo /></Link></nav>
        <div className="hf-card hf-done hf-join-thanks">
          <p className="hf-done-title">You're in.</p>
          <p>Joe will be in touch before launch to finish setting you up.</p>
        </div>
      </main>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="hf-card hf-form hf-join-section">
      <p className="hf-kicker">Step {n}</p>
      <h2 className="hf-form-title">{title}</h2>
      {children}
    </section>
  );
}

function Field({ name, label, error, children }: { name: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className={`hf-field ${error ? "hf-field-error" : ""}`} htmlFor={name} data-field={name}>
      <span className="hf-label">{label}</span>
      {children}
      {error && <span className="hf-error">{error}</span>}
    </label>
  );
}

function Choices({ name, label, error, children }: { name: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <fieldset className={`hf-field hf-choices ${error ? "hf-field-error" : ""}`} data-field={name}>
      <legend className="hf-label">{label}</legend>
      <div className="hf-chips">{children}</div>
      {error && <span className="hf-error">{error}</span>}
    </fieldset>
  );
}

function Chip({ type, name, value, label, onChange }: { type: "radio" | "checkbox"; name: string; value: string; label: string; onChange?: (checked: boolean) => void }) {
  return (
    <label className="hf-chip">
      <input type={type} name={name} value={value} onChange={(e) => onChange?.(e.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Check({ name, label, error }: { name: string; label: string; error?: string | undefined }) {
  return (
    <label className={`hf-check ${error ? "hf-field-error" : ""}`} data-field={name}>
      <input type="checkbox" name={name} value="yes" />
      <span>{label}</span>
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
