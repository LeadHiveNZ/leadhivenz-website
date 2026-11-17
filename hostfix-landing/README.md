# HostFix landing page (for ads)

The page Facebook ads point to: lead form first, then the Loom video, the deal (free to join,
fixed prices, pay when it's fixed), prices and questions. Nothing is sold on the page: the next step
is a phone call. Built here, hosted on Lovable (project "HostFix Queenstown").

- `src/HostFixLanding.tsx`: the whole page. The Loom link is the one constant at the top.
- `src/hostfix.css`: its styles.
- `lovable/index.tsx`: the Lovable page route; its form posts to `/api/public/leads`.
- `lovable/api-public-leads.ts`: saves each lead, then emails it to hello@leadhivenz.com through Resend (needs the `RESEND_API_KEY` secret in Lovable).
- `npm install && npm run build && npm run preview` shows it locally (leads kept in the browser only).

Copied into Lovable as `src/components/HostFixLanding.tsx`, `src/hostfix.css` (imported from
`src/styles.css`) and `src/routes/index.tsx`.
