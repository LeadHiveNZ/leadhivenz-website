import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HostFixTradieJoin } from "@/components/HostFixTradieJoin";

export const Route = createFileRoute("/tradies_/join")({
  head: () => ({
    meta: [
      { title: "Sign up as a HostFix tradie · Lock in your spot" },
      { name: "description", content: "Plumbers, sparkies, gasfitters and handymen: sign the HostFix tradie agreement and lock in your spot before the app launches. Free, nothing charged to you." },
      { property: "og:title", content: "Lock in your spot as a HostFix tradie" },
      { property: "og:description", content: "Sign up and sign the tradie agreement before launch. Free to join, nothing charged to you, ever." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const navigate = useNavigate();
  return <HostFixTradieJoin onSigned={() => navigate({ to: "/tradies/join/thanks" })} />;
}
