import { brand } from "@config/brand";

/**
 * The logo mark. Uses your own file if config/brand.ts names one, otherwise a
 * built-in house-and-tick drawn in the brand colours.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  if (brand.logoSrc) {
    // A plain <img> on purpose: the logo can be any file type, including SVG.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logoSrc} alt="" width={size} height={size} className="shrink-0" />;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="40" height="40" rx="10" fill="var(--hf-brand)" />
      <path d="M8.5 19.5 20 9.5l11.5 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M11.5 18v11.5a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V18"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m15.5 23.4 3.2 3.2 6-6.4" stroke="var(--hf-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
