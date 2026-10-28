"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ sent: initiallySent }: { sent: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(initiallySent);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message.includes("Signups not allowed") ? "That email isn't set up as crew. Ask the office." : error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div>
        <p className="mb-4 text-lg font-semibold">Check your email on this phone and tap the link.</p>
        <button className="btn btn-outline" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-semibold">Email</span>
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.co.nz"
        />
      </label>
      {error && <p className="text-danger">{error}</p>}
      <button className="btn btn-accent" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Email me a login link"}
      </button>
    </form>
  );
}
