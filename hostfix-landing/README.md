# HostFix landing page (for ads)

The page Facebook ads point to: lead form first, then the Loom video, the $50 founding deposit,
prices and questions. Built here, hosted on Lovable (project "HostFix Queenstown").

- `src/HostFixLanding.tsx`: the whole page. The Loom and Stripe links are the two constants at the top.
- `src/hostfix.css`: its styles.
- `lovable/index.tsx`: the Lovable route that saves leads to the `leads` table.
- `npm install && npm run build && npm run preview` shows it locally (leads kept in the browser only).

Copied into Lovable as `src/components/HostFixLanding.tsx`, `src/hostfix.css` (imported from
`src/styles.css`) and `src/routes/index.tsx`.
