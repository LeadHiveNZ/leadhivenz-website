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
   * Walkthrough videos shown on the public pages, as Loom embed links
   * (https://www.loom.com/embed/<id>). null hides the section.
   */
  walkthroughs: {
    /** The app from the tradie's side, about 3 minutes. Shown on the tradie page. */
    tradie: "https://www.loom.com/embed/b696de9fed124b94a9d6def8f463f8ed" as string | null,
  },

  /**
   * Logo. Leave as null to use the built-in mark: an open door, drawn in the
   * colours below. To use your own logo, put the file in the /public folder
   * and set this to its path, for example "/my-logo.svg".
   */
  logoSrc: null as string | null,

  /**
   * COLOURS. Plum is the brand: text, the logo and the main buttons. Lime is
   * the highlight: one per screen, and the buttons on dark sections. Lime is
   * never used for words on a light background, because it cannot be read.
   */
  colours: {
    /** Main brand colour: the logo, main buttons, links. */
    brand: "#3b1e3f",
    /** Darker brand colour for hover states and dark sections. */
    brandDark: "#2a132d",
    /** The highlight. Buttons on dark sections, one accent per screen. */
    accent: "#d4f23a",
    /** Highlight hover. */
    accentDark: "#bfdd1f",
    /** Main text. */
    ink: "#24122a",
    /** Secondary text. */
    muted: "#6a5b70",
    /** Cards and form fields. */
    surface: "#ffffff",
    /** Soft lilac behind selected things and some sections. */
    tint: "#ebe3f0",
    /** The page background: warm paper. */
    sand: "#f7f2ea",
    /** Borders and dividing lines. */
    line: "#e2d9e6",
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
