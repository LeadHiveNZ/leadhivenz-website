import Link from "next/link";
import { brand } from "@config/brand";
import { buttonClass } from "@/components/forms/styles";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center bg-tint">
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">We can&apos;t find that page.</h1>
        <p className="mt-3 text-lg text-muted">The link may be old or mistyped.</p>
        <Link href="/" className={`${buttonClass} mt-7`}>
          Go to the {brand.name} home page
        </Link>
      </div>
    </main>
  );
}
