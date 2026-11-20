import { createFileRoute } from "@tanstack/react-router";
import { HostFixTradieThanks } from "@/components/HostFixTradieJoin";

export const Route = createFileRoute("/tradies_/join_/thanks")({
  head: () => ({
    meta: [
      { title: "You're in · HostFix tradies" },
      { name: "description", content: "Thanks for signing up as a HostFix tradie. Joe will be in touch before launch." },
      { property: "og:title", content: "You're in · HostFix tradies" },
      { property: "og:description", content: "Thanks for signing up. Joe will be in touch before launch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostFixTradieThanks,
});
