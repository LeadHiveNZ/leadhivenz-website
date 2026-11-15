import { brand } from "@config/brand";

/**
 * THE LOGO MARK: an open door. A plum doorway with a lime door swung open
 * beside it. Someone is being let in to fix something.
 *
 * It is drawn here rather than loaded from a file, so it stays sharp at any
 * size and follows the colours in config/brand.ts. To use your own logo
 * instead, set logoSrc in that file.
 *
 * tone="light" is for dark backgrounds: the doorway turns to paper.
 */
export function LogoMark({ size = 32, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  if (brand.logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element -- a plain image is right for a small logo of unknown size
    return <img src={brand.logoSrc} alt="" width={size} height={size} className="shrink-0" />;
  }
  const doorway = tone === "light" ? "var(--hf-sand)" : "var(--hf-brand)";
  const outline = tone === "light" ? "var(--hf-brand-dark)" : "var(--hf-brand)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect x="11" y="6" width="26" height="52" rx="4" fill={doorway} />
      <path d="M37 6 L53 13 V51 L37 58 Z" fill="var(--hf-accent)" stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="47" cy="33" r="2.6" fill={outline} />
    </svg>
  );
}

/** The mark and the name together. */
export function Logo({ size = 30, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${tone === "light" ? "text-white" : "text-ink"}`}>
      <LogoMark size={size} tone={tone} />
      <span className="display text-[1.35rem] leading-none tracking-[-0.04em]">{brand.name}</span>
    </span>
  );
}
