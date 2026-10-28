/**
 * BRAND SETTINGS — the only file to edit when re-skinning this app for another business.
 *
 * Everything brand-specific (name, colours, fonts, logo, phone, time zone, van names)
 * lives here. Components read from this file; nothing else hard-codes a brand value.
 *
 * Fonts: change the names here AND the two imports in ./fonts.ts (next/font needs
 * static import names, so it can't read them from this object).
 */
export const brand = {
  /** Full business name, shown in the wordmark and page titles. */
  name: "Mike's Plumbing & Gas",
  /** Short name for the home-screen icon (12 characters or fewer looks best). */
  shortName: "Crew",
  /** What the app is called in the tab title, e.g. "Crew · Mike's Plumbing & Gas". */
  appName: "Crew",
  /** Office / after-hours phone shown on the login screen and in the crew menu. */
  phone: "03 123 4567",
  /** City used in copy (directions, time zone hints). */
  city: "Christchurch",
  /** IANA time zone. All times in the app are displayed in this zone. */
  timeZone: "Pacific/Auckland",
  /** Locale used for dates, times and currency. */
  locale: "en-NZ",
  currency: "NZD",

  colours: {
    /** Primary (navy): headers, nav bar, logo text. */
    primary: "#0B2545",
    /** Accent (hi-vis orange): main buttons and the On site status. */
    accent: "#FF6B00",
    /** Page background. */
    background: "#F4F5F7",
    /** Cards. */
    surface: "#FFFFFF",
    /** Done / success. */
    success: "#1E8E3E",
    /** Warnings and over-quote hours. */
    danger: "#D93025",
    /** Body text on light backgrounds. */
    text: "#111827",
    /** Secondary text. */
    muted: "#4B5563",
    /** Card borders. */
    border: "#D9DDE3",
  },

  fonts: {
    /** Headings: bold, uppercase. */
    heading: "Barlow Condensed",
    /** Body text, minimum 16px. */
    body: "Inter",
  },

  logo: {
    /** Wordmark text. Set to "" to hide the text when a real logo image is used. */
    wordmark: "MIKE'S PLUMBING & GAS",
    /**
     * Path (under /public) to a real logo image, e.g. "/logo.png". Leave null to use the
     * built-in orange droplet + wordmark.
     */
    imageSrc: null as string | null,
  },

  /** Vans / crews. `id` is what the calendar title uses in square brackets: "[Van 2] ...". */
  vans: [
    { id: 1, label: "Van 1", shortLabel: "V1" },
    { id: 2, label: "Van 2", shortLabel: "V2" },
  ],

  /** Travel zones, used by the price book (phase 2) and shown on job cards. */
  travelZones: ["1", "2", "3", "beyond"] as const,

  /**
   * Labour rate bands, worked out from the time a job starts and the day of the week.
   * Times are 24-hour, local to `timeZone`.
   */
  rateBands: {
    standard: { label: "Standard", days: [1, 2, 3, 4, 5], from: "07:00", to: "17:00" },
    afterHours: { label: "After hours" },
    nightSunday: { label: "Night / Sunday", nightFrom: "22:00", nightTo: "06:00" },
  },

  /** Hours block size for the +time buttons, in minutes. */
  timeBlockMinutes: 15,
  /** Longest side of a photo after compression, in pixels. */
  photoMaxEdge: 1600,
  /** How long a magic-link login stays valid on the phone, in days (set in Supabase too). */
  sessionDays: 30,
} as const;

export type Brand = typeof brand;
export type TravelZone = (typeof brand.travelZones)[number];
