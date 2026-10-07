import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

const SITE = "https://contenthive.au";

const faqs = [
  { q: "Where do you film?", a: "Across Melbourne and surrounds: the eastern and south-eastern suburbs, the Mornington Peninsula, Geelong and the growth corridors. For trade businesses in New Zealand we work through our sister company LeadHive NZ." },
  { q: "What trades is this for?", a: "Plumbers, electricians, heating and cooling, roofers, builders, landscapers and other owner-operator trade businesses that do visible work on site." },
  { q: "Do I have to be on camera?", a: "A little. Faces build trust, but most of the content is the work itself: before and afters, the van, the crew, the finished job." },
  { q: "How much does it cost?", a: "A 90 day partnership priced as a monthly fee with filming, editing, posting and a monthly review included. The first three Melbourne clients get the foundation partner rate." },
  { q: "Do you run paid ads too?", a: "No. ContentHive is organic content. For paid Google Ads leads, see LeadHive." },
  { q: "Who's behind ContentHive?", a: "Joe Ingram, who grew a hospitality brand to 15,000 followers from scratch and runs LeadHive NZ, a lead generation agency for trade businesses." },
];

const schema = [
  {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${SITE}/#org`,
    name: "ContentHive",
    url: `${SITE}/`,
    email: "hello@leadhivenz.com",
    description: "Done-for-you social media content for trade businesses in Melbourne and across Australia and New Zealand. We film on site, edit for TikTok, Instagram, Facebook and YouTube Shorts, and post every business day.",
    founder: { "@type": "Person", name: "Joe Ingram" },
    areaServed: [
      { "@type": "City", name: "Melbourne" },
      { "@type": "Country", name: "Australia" },
      { "@type": "Country", name: "New Zealand" },
    ],
    serviceType: ["Social media content creation for tradies", "Videography for trade businesses", "Social media management for trades"],
    parentOrganization: { "@type": "Organization", name: "LeadHive NZ", url: "https://leadhivenz.co" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContentHive | Social Media Content for Tradies in Melbourne: We Film, Edit & Post Every Day" },
      {
        name: "description",
        content:
          "Done-for-you social media content for plumbers, electricians, heating and cooling, roofers and builders in Melbourne. We film on your site, edit for four platforms and post every business day. No lock-in. Book a 15 minute call.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "ContentHive | Social media content for tradies, done for you" },
      { property: "og:description", content: "We film on your site in Melbourne, cut it for TikTok, Instagram, Facebook and YouTube Shorts, and post every business day. Built for trade businesses." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:locale", content: "en_AU" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: schema.map((s) => ({ type: "application/ld+json", children: JSON.stringify(s) })),
  }),
  component: Index,
});
