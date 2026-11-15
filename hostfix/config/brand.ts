/**
 * BRAND SETTINGS
 * ---------------------------------------------------------------------------
 * This is the one place to change the name, colours, logo and contact details.
 * Change a value here, save, and the whole site updates.
 *
 * Anything containing "[EDIT" is a placeholder that still needs a real value.
 */
export const brand = {
  /** The name shown in the header, page titles, texts and emails. */
  name: "HostFix",

  /** One short line under the name on the home page. */
  tagline: "Holiday home maintenance, sorted.",

  /** Shown by Google and when someone shares a link. */
  description:
    "Fixed-price repairs for holiday homes and short-stay rentals. Local tradies, fast response, photos when it's done.",

  /**
   * Logo. Leave as null to use the built-in house-and-tick mark, which picks up
   * the colours below. To use your own logo, put the file in the /public folder
   * and set this to its path, for example "/my-logo.svg".
   */
  logoSrc: null as string | null,

  colours: {
    /** Main brand colour: links, icons, highlights. */
    brand: "#0e7c66",
    /** Darker brand colour for hover states. */
    brandDark: "#0a5f4e",
    /** Call-to-action buttons. */
    accent: "#f5a524",
    /** Button hover. */
    accentDark: "#dd8a0c",
    /** Main text. */
    ink: "#0b1f33",
    /** Secondary text. */
    muted: "#55657a",
    /** Page background. */
    surface: "#ffffff",
    /** Soft background behind some sections. */
    tint: "#f1f8f6",
    /** Warm background behind other sections. */
    sand: "#fbf7ef",
    /** Borders and dividing lines. */
    line: "#dfe6ea",
  },

  /** Shown in the footer and in "something went wrong" messages. */
  contact: {
    email: "[EDIT: your contact email]",
    /** Optional. Leave empty to hide. */
    phone: "",
  },

  /** The legal entity behind the site, shown in the footer. */
  legalName: "[EDIT: your company name]",
} as const;

export type Brand = typeof brand;
