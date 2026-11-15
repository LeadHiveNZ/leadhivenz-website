import type { MetadataRoute } from "next";

/** Tells search engines to leave the private and after-form pages alone. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/owners/thanks", "/owners/founding-member", "/owners/deposit/", "/tradies/thanks"],
    },
  };
}
