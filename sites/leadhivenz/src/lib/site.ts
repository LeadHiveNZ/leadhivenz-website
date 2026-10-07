/**
 * Single source of truth for the public site URL.
 * The code previously hard-coded https://leadhivenz.co in six places.
 * If the live domain is leadhivenz.com, change it HERE only.
 */
export const SITE_URL = "https://leadhivenz.co";
export const SITE_NAME = "LeadHive NZ";
export const CONTACT_EMAIL = "hello@leadhivenz.com";

export const abs = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;
