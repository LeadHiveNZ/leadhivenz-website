/** A small set of line icons, drawn here so nothing is loaded from an icon service. */

const PATHS = {
  home: "M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10",
  jobs: "M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01",
  property: "M5 20V7l7-3 7 3v13M9 20v-5h6v5M9 10h.01M15 10h.01",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  plus: "M12 5v14M5 12h14",
  offers: "M4 7h16v10H4zM4 8l8 6 8-6",
  pay: "M3.5 7.5h17v9h-17zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 10v4M17.5 10v4",
  queue: "M12 8v5M12 16.5h.01M10.3 4.3 3 17a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  chart: "M5 20V10M12 20V4M19 20v-7",
  tradie: "M14.5 6.5a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.1-5.1a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4Z",
  menu: "M6 4h12v16l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6",
  market: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.2a3.5 3.5 0 0 1 0 6.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20",
  log: "M6 4h9l4 4v12H6zM14 4v5h5M9 13h7M9 17h7",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2",
  check: "M5 12.5 10 17.5 19.5 7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.5l3.5 2",
  camera: "M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  chevron: "M6 9l6 6 6-6",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  shield: "M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6l-7-3ZM9 12l2.2 2.2L15.5 10",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s2.5 1 5 1Zm0 0c1.5-3 5-3 5-1s-2.5 1-5 1Z",
  out: "M9 20H5V4h4M15 8l4 4-4 4M19 12H9",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M16 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z",
  door: "M6 21V4.5L14 3v18M14 5.5h4V21M10.5 12.5h.01M3.5 21h17",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
