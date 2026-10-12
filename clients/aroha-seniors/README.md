# Aroha Seniors Charitable Trust — website

Client: **Aroha Seniors Charitable Trust** (registered charity **CC63126**), Flat Bush, Auckland.
Contact: **Amelia Kolio**, 022 178 0876, amelia_asct@outlook.com.
Lead: LeadHive website demo request, 12/10/2026 (Resend notification to hello@leadhivenz.com).

A five-page charity site in one file, `index.html`. Pages switch by hash route, the same idea
as the `?page=` switch in the trade templates. In Lovable each route becomes a real page.

| Route              | Page          | Main job                                             |
|--------------------|---------------|------------------------------------------------------|
| `#/`               | Home          | Mission, programmes, how to join, get involved, FAQ  |
| `#/about`          | About us      | Story, timeline, values, who we support, people, accountability |
| `#/programmes`     | What we do    | Six programmes, each with its own anchor (`#/programmes/outings`) |
| `#/get-involved`   | Get involved  | Volunteer, donate, partner, interest form            |
| `#/contact`        | Contact       | Call/email/Facebook, contact form, helplines         |

Open `index.html` in a browser to preview it. Screens of every page are in `screens/`.

## Built for older readers

- **Text size control** (A / A+ / A++) in the top bar. The visitor's choice is saved in their browser.
- Large type throughout: 18px base and 56px+ buttons. Headings use **Literata** and body text uses
  **Lexend**, a typeface designed for easier reading. Both render te reo macrons correctly.
  (Fraunces was dropped because its Google Fonts build misplaces macrons: "Mālō" rendered wrong.)
- Phone number in the top bar, hero, every call-to-action and the footer. Many older people prefer to ring.
- Checked with axe-core (WCAG 2.1 AA plus best practice): 0 violations on all five pages, desktop and mobile.
- No sideways scroll from 320px to 1440px wide at any of the three text sizes.
- Motion respects "reduce motion" settings. The greeting band then wraps instead of scrolling.

## Where the content came from

Facebook, the Charities Register and Open Collective are blocked by this environment's network
policy, so the copy is built from web-search summaries of those sources. **Nothing was taken from
the trust's Facebook page.**

- **Charities Register (CC63126)**: registered 7/03/2025. Name changed from *Aroha Seniors Group*
  to *Aroha Seniors Charitable Trust* on 21/03/2026. Charitable trust under the Charitable Trusts Act.
  Beneficiaries: senior citizens, vulnerable adults, adults with disabilities. Activities: social
  services; advice, information and advocacy. Address for service in Flat Bush. Balance date 31 March.
- **Open Collective "AROHA Elderly"** (South Auckland; admins Amelia and Cathy T; group-tour expense
  November 2024). Stated aims: new friendships, social connection, less loneliness, through
  social gatherings, outing transport, companionship and technology training. This is very likely
  the same group but it is **not confirmed**.
- **Stat band**: "1 in 5 frail older New Zealanders living at home report extreme loneliness",
  from a University of Otago study (2017) of older people in home-care (interRAI) assessments.
- **Helplines on the contact page**: 111; Healthline 0800 611 116; Elder Abuse Response Service
  0800 32 668 65 (24/7); 1737.

## Confirm with Amelia before launch

1. **Programmes.** The six programmes (gatherings, outings, companionship, digital help, advice and
   advocacy, disability and wellbeing support) follow the register and Open Collective, not a list
   from the trust. Remove or rename any they don't run. Each is one `<article class="prog">` block
   plus one card on the home page.
2. **Service area.** The copy says "Flat Bush and across South & East Auckland".
3. **Story wording** on the About page ("began as a community group…") is general. Swap in their
   real founding story if they have one.
4. **Amelia's title.** Currently "Your first point of contact" (`CONFIG.contact.role`).
5. **Trustees.** Add names and photos if they want them shown. Right now there is one "Our trust board" card.
6. **Bank account** for donations: set `CONFIG.donate.bankAccount` and the card shows it.
   Until then it says "Request our bank details".
7. **Donee status.** Only set `CONFIG.donate.doneeStatus: true` once IRD has approved it. That shows
   the 33.33% tax-credit line. Registered charity status alone does not guarantee donee status.
8. **FAQ answers** (cost, transport, language) are deliberately non-committal. Tighten them once known.
9. **Logo.** The arch-and-two-figures mark is new. Swap it if they already have a logo (it is three inline
   SVGs: header, mobile menu and footer, plus the favicon).
10. **Credit.** The footer says "Website by LeadHive". Turn it off with `CONFIG.credit.show: false`.

## Photos (biggest upgrade)

Every image slot shows a designed illustration until a photo is supplied. Save photos from their
Facebook page into `img/` with these names, or put URLs in `CONFIG.photos`:

| File                    | Where it shows                     | Shape        |
|-------------------------|------------------------------------|--------------|
| `img/hero.jpg`          | Home hero arch                     | portrait 4:5 |
| `img/about.jpg`         | About page header arch             | portrait 4:5 |
| `img/gatherings.jpg`    | What we do, programme 01           | portrait 4:5 |
| `img/outings.jpg`       | programme 02                       | portrait 4:5 |
| `img/companionship.jpg` | programme 03                       | portrait 4:5 |
| `img/digital.jpg`       | programme 04                       | portrait 4:5 |
| `img/advice.jpg`        | programme 05                       | portrait 4:5 |
| `img/wellbeing.jpg`     | programme 06                       | portrait 4:5 |
| `img/amelia.jpg`        | About, "Our people" card           | square       |

On phones the programme slots crop to landscape, so keep faces near the centre. Get the trust's OK
to use photos of members.

## Forms

Both forms (Get involved, Contact) send JSON to `CONFIG.form.endpoint`. When the endpoint is blank,
which is how the demo ships, they open the visitor's email app addressed to Amelia with the message
filled in. In Lovable, point the endpoint at the project's own enquiry route (same Resend pattern as
the trade sites) and add amelia_asct@outlook.com as a recipient.

Payload: `form`, `page`, `sentAt`, `name`, `phone`, `email`, plus `interest` or `who`, `prefer`, `message`.

## Launch checklist

1. Confirm the items above with Amelia. Add photos and the bank account.
2. Build in Lovable (or host the file as is). Attach their domain and make sure HTTPS is on.
3. Wire the form endpoint and send a test enquiry from each form.
4. Update the Facebook page's website link and Google Business Profile.
5. Optional: apply for Google Ad Grants through Google for Nonprofits. Registered NZ charities with a
   working website are generally eligible, but check current terms. If it's approved, set up and run
   the account for them.
