import { brand } from "@/config/brand";

/** Orange droplet + wordmark. Swap to a real logo by setting brand.logo.imageSrc. */
export function Wordmark({ size = "md", light = false }: { size?: "sm" | "md" | "lg"; light?: boolean }) {
  const px = size === "lg" ? 40 : size === "md" ? 28 : 22;
  const text = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base";
  if (brand.logo.imageSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo.imageSrc} alt={brand.name} style={{ height: px * 1.2 }} className="w-auto" />;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Droplet size={px} />
      {brand.logo.wordmark && (
        <span className={`heading leading-none ${text}`} style={{ color: light ? "#fff" : brand.colours.primary }}>
          {brand.logo.wordmark}
        </span>
      )}
    </span>
  );
}

export function Droplet({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c3.2 4.3 7 8.4 7 12.6a7 7 0 0 1-14 0c0-4.2 3.8-8.3 7-12.6z" fill={brand.colours.accent} />
      <path d="M9 15.2a3 3 0 0 0 2.2 2.9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
