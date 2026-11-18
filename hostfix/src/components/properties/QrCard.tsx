import { Logo } from "@/components/Logo";

/**
 * The card that goes on the fridge or in the welcome folder: the guest QR
 * code for one property. Used by the single card page and by "print every
 * card", so both print the same thing.
 */
export function QrCard({ url, qr, propertyName }: { url: string; qr: string; propertyName: string }) {
  return (
    <div className="qr-card mx-auto w-full max-w-sm rounded-3xl border-2 border-brand bg-white p-7 text-center print:border print:shadow-none">
      <div className="flex justify-center">
        <Logo size={30} />
      </div>
      <p className="display mt-5 text-3xl leading-tight text-ink">Something not working?</p>
      <p className="mt-2 text-lg text-muted">Point your phone camera here and tell us. It takes one minute.</p>
      <div className="mx-auto mt-5 w-56 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code for reporting a problem" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="mt-5 text-base font-semibold text-ink">No app. No account. We tell your host and send help.</p>
      <p className="mt-4 border-t border-line pt-3 text-xs break-all text-muted">{url.replace(/^https?:\/\//, "")}</p>
      <p className="mt-1 text-xs text-muted">{propertyName}</p>
    </div>
  );
}
