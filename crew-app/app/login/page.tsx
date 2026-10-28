import { brand } from "@/config/brand";
import { Wordmark } from "@/components/Wordmark";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ setup?: string; error?: string; sent?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Wordmark size="lg" />
      </div>
      <div className="card p-6">
        <h1 className="mb-1 text-3xl">Log in</h1>
        <p className="mb-5 text-muted">No password. WeWe&apos;ll text nothing and email you a link. Tap it on this phone and you&apos;re in for {brand.sessionDays} days.apos;ll email you a link; tap it on this phone and youWe&apos;ll text nothing and email you a link. Tap it on this phone and you&apos;re in for {brand.sessionDays} days.apos;re in for {brand.sessionDays} days.</p>
        {sp.setup && (
          <p className="mb-4 rounded-xl bg-danger/10 p-3 text-danger">
            Your login works but you&apos;re not set up as crew yet. Ask the office to add you.
          </p>
        )}
        {sp.error && <p className="mb-4 rounded-xl bg-danger/10 p-3 text-danger">That link didn&apos;t work or has expired. Send a new one.</p>}
        <LoginForm sent={!!sp.sent} />
      </div>
      <p className="mt-6 text-center text-muted">
        Stuck? Call the office on{" "}
        <a className="font-semibold text-primary underline" href={`tel:${brand.phone.replace(/\s/g, "")}`}>
          {brand.phone}
        </a>
      </p>
    </main>
  );
}
