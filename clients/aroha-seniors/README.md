# Aroha Seniors Charitable Trust — website

Client: **Aroha Seniors Charitable Trust** (registered charity **CC63126**), Flat Bush, Auckland.
Contact: **Amelia Kolio**, 022 178 0876, amelia_asct@outlook.com.
Meals on Wheels orders: **Korina Grace** (Kai Manager), 022 605 2361.
Lead: LeadHive website demo request, 12/10/2026 (Resend notification to hello@leadhivenz.com).

A six-page charity website in the trust's own branding: their heart logo, kawakawa green and
gold, their tagline "To serve with Aroha" and their values (manaakitanga, whanaungatanga,
kotahitanga).

```
build.py              run this after editing anything in src/ (standard-library Python only)
src/                  the source: layout.html, pages/*.html, styles.css, site.js
site/                 THE WEBSITE. Upload this folder to any host. One HTML file per page.
  index.html  about.html  what-we-do.html  get-involved.html  contact.html  policies.html
  assets/styles.css  assets/site.js  assets/img/  assets/docs/ (the policies PDF)
preview/              the same pages, each self-contained (CSS, JS, images inlined),
                      for previewing or emailing a single page on its own
screens/              rendered screenshots, desktop and mobile
```

| Page              | Main job                                                         |
|-------------------|------------------------------------------------------------------|
| `index.html`      | Mission, real photo hero, programmes, how to join, get involved, FAQ |
| `about.html`      | Logo, story, timeline, banner and values, who we support, people, accountability |
| `what-we-do.html` | Seven programmes incl. Meals on Wheels, each with an anchor (`what-we-do.html#meals`) |
| `get-involved.html` | Volunteer, donate, partner, interest form (`?i=Donate` preselects it) |
| `contact.html`    | Call, email, Facebook, contact form, helplines                   |
| `policies.html`   | The trust's Public Policies as a page, plus the PDF to download (footer "Our policies") |

## The trust's own images (site/assets/img/)

Made from the two images Joe supplied on 12/10/2026 (their logo, and their banner with a photo of members doing poi).

| File                  | From                                   | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `logo-heart.png`      | Heart cut from the **new logo** (27/10/2026), transparent | Header; footer (on a cream tile, as the fine lines vanish on dark green) |
| `favicon.png`, `apple-touch-icon.png` | Same heart (new logo)  | Browser tab and phone home-screen icon    |
| `logo-full.jpg`       | Full new logo, with "To Serve with Aroha" and the trust name | About page header; logo in the search-engine data |
| `banner.jpg`          | Full banner                            | About page, above the values              |
| `hero.jpg`            | Banner photo, three members with poi   | Home page hero                            |
| `gatherings.jpg`      | Banner photo, two members with poi     | What we do, Friendship gatherings         |

Photos Amelia sent on 12/10/2026 (her feedback round):

| File                  | Photo                                  | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `group.jpg`           | Whole group in red and black ponchos   | Home "Who we are"; About gallery          |
| `g-sheepworld.jpg`    | Two members at Sheepworld              | About gallery                             |
| `g-street.jpg`        | Same photo, wide                       | About gallery                             |
| `involved.jpg`, `g-music.jpg` | Members laughing outside Bunnings (cropped to leave out a hazard sign) | Get involved header; About gallery |

Second batch from Amelia (12/10/2026):

| File                  | Photo                                  | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `celebration.jpg`     | Big group of members and whānau, many in red | About, wide photo under the header  |
| `companionship.jpg`   | Member in a red coat with a friend's arm around her | What we do, Companionship    |
| `outings.jpg`         | Member and a young woman feeding a lamb (from the collage) | What we do, Outings   |
| `wellbeing.jpg`       | Member in a wheelchair on a garden path (collage) | What we do, Disability & wellbeing |
| `g-bowls.jpg`, `g-booth.jpg`, `g-selfie.jpg`, `g-group2.jpg` | The other four collage photos | About gallery |

A headshot (woman in a red and black top) also came through. It turned out to be Korina (see below).

Korina Grace's promo graphic from the trust (14/10/2026). Joe asked for her photo in the Meals on
Wheels section in place of the cuppa photo, which is no longer on the site:

| File                  | Photo                                  | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `mow.jpg`, `meals.jpg`| Korina, cut from the left of the graphic (logo, text and "Made with AI" tag left out) | Home Meals on Wheels band; What we do, Meals on Wheels |
| `korina.jpg`          | Same photo, square head and shoulders  | About, Korina's card (replaces her initials) |

Her graphic gives her title as "Kai Services Manager". The site uses "Kai Manager", from Amelia's
email. Change `kai_role` in `build.py` (and the "our Kai Manager" wording in the pages) if they prefer the longer title.

**More photos:** save JPGs in `site/assets/img/` with these names and run `python3 build.py`.
Each one replaces the illustration in its slot. Shape is portrait 4:5; on phones they crop to
landscape, so keep faces near the centre.
Still open: `digital.jpg`, `advice.jpg` and `amelia.jpg` (square).

## Public policies (from Amelia, 23/10/2026)

`site/assets/docs/aroha-seniors-public-policies.pdf` is the PDF exactly as Amelia sent it.
`src/pages/policies.html` is the same text as a web page (easier to read on a phone), with a
contents list and a download button. It's linked from the footer on every page, the About page's
"Open & accountable" list, and the privacy note under both forms (`policies.html#privacy`).

Two drafting notes in the PDF are left off the web page:

- Section 4: "Please confirm these contact details before publication." (The Elder Abuse Response
  Service numbers, 0800 32 668 65 and text 5032, are the published ones.)
- Section 11: "The trustees should review and approve this document before it is published…"

The PDF itself still has both lines. If Amelia sends a cleaned-up PDF, save it over the same file
name and rebuild; the size on the download button updates itself.

The policies also list services the What we do page doesn't (home help and house cleaning,
shopping, laundry, foot pampering, transport) and give Amelia's title as "Kaiārahi / Senior
Advocate". Worth lining the What we do page and `contact_role` up with them.

## Built for older readers

- **Text size control** (A / A+ / A++) in the top bar. The choice carries from page to page.
- Large type: 18px base, 56px+ buttons. Headings use Literata and body text uses Lexend. Both render
  te reo macrons correctly. Fraunces was dropped because its Google Fonts build misplaces macrons.
- Phone number in the top bar, hero, every call-to-action and the footer.
- Works without JavaScript: the mobile menu is a `<details>` element, links are plain pages, and the
  forms fall back to the visitor's email app. JavaScript only adds text size, animations and form posting.
- axe-core (WCAG 2.1 AA plus best practice): 0 violations on all six pages, desktop and mobile,
  for both `site/` and `preview/`.
- No sideways scroll from 320px to 1440px at all three text sizes.

## Where the content came from

Facebook, the Charities Register and Open Collective are blocked by this environment's network
policy, so the copy is built from web-search summaries plus the trust's logo and banner.

- **Charities Register (CC63126)**: registered 7/03/2025. Renamed from *Aroha Seniors Group* to
  *Aroha Seniors Charitable Trust* on 21/03/2026. Charitable Trusts Act. Beneficiaries: seniors,
  vulnerable adults, adults with disabilities. Activities: social services; advice, information and
  advocacy. Flat Bush address for service. Balance date 31 March.
- **Open Collective "AROHA Elderly"** (South Auckland; admins Amelia and Cathy T). Aims: friendship,
  social connection, less loneliness, through gatherings, outing transport, companionship and
  technology training. Very likely the same group, not confirmed.
- **Their banner**: tagline "To serve with Aroha", "Caring for our seniors, strengthening our community",
  values Manaakitanga, Whanaungatanga, Kotahitanga. The photo shows a poi session, so poi is mentioned
  under Friendship gatherings.
- **Amelia's feedback (12/10/2026)**: add Meals on Wheels (fortnightly, ordered through Kai Manager
  Korina Grace on 022 605 2361) and remove the University of Otago loneliness statistic. Both done.
- **Helplines**: 111; Healthline 0800 611 116; Elder Abuse Response Service 0800 32 668 65; 1737.

## Confirm with Amelia before launch

1. **Programmes.** The six programmes follow the register and Open Collective, not a list from the
   trust. Remove or rename any they don't run (`src/pages/what-we-do.html` plus the cards in `src/pages/index.html`).
2. **Meals on Wheels details**: area covered and any cost, if they want those on the site.
   Also whether to mention Z's Good in the Hood (the sign in the group photo) as a supporter.
3. **Service area**: "Flat Bush and across South & East Auckland".
4. **Story wording** on the About page is general. Swap in their real founding story if they have one.
5. **Amelia's title**: `contact_role` in `build.py` (currently "Your first point of contact").
6. **Trustees**: add names and photos if wanted.
7. **Bank account**: set `bank_account` in `build.py` and the donate card shows it.
8. **Donee status**: set `donee_status: True` only once IRD has approved it (adds the 33.33% line).
9. **FAQ answers** (cost, transport, language) are deliberately non-committal.
10. **Credit**: the footer says "Website by LeadHive". Set `credit` to `None` in `build.py` to remove it.

## Forms (Netlify Forms)

Both forms (Contact, Get involved) are Netlify forms: `name="contact"` / `name="get-involved"`,
`data-netlify="true"`, a hidden `form-name`, a hidden `subject` (used as the notification email's
subject) and a `bot-field` honeypot. `site.js` posts them to `/` in the background and shows the
thank-you box. With JavaScript off they post as a normal form and Netlify shows its own thank-you page.

If a post fails (form detection off, offline) or the page is opened as a local file, the form opens
the visitor's email app addressed to Amelia with the message filled in, so nothing is lost.
`form_endpoint` in `build.py` overrides all this with a JSON POST if ever needed.

Netlify setup (once per site):

1. Site configuration, Forms: **Enable form detection**. Do this before deploying; detection runs at
   deploy time, so if it's switched on afterwards, deploy the zip again.
2. Deploy. The Forms tab should list `contact` and `get-involved`.
3. Site configuration, Notifications, Emails and webhooks, Form submission notifications:
   add an email notification for any form to **amelia_asct@outlook.com**, and one to
   **hello@leadhivenz.com** so LeadHive sees the enquiries too.
4. Send a test from each form. The first notification can land in junk: ask Amelia to mark it safe.

## Domain and hosting

- Domain: **arohaseniorscharitabletrust.com**, bought by Joe on Cloudflare (27/10/2026). Cloudflare
  Registrar domains must keep Cloudflare's nameservers, so DNS stays there and points at Netlify.
- Hosting: Netlify site `aroha-seniors-preview` (https://aroha-seniors-preview.netlify.app).
- `site_url` in `build.py` sets the canonical links, share image, `sitemap.xml` and `robots.txt`.

Cloudflare DNS (both records **DNS only**, grey cloud, not proxied, so Netlify can issue the HTTPS certificate):

| Type  | Name | Content                              |
|-------|------|--------------------------------------|
| A     | `@`  | `75.2.60.5` (Netlify's load balancer; use the value Netlify shows if it differs) |
| CNAME | `www`| `aroha-seniors-preview.netlify.app`  |

Netlify: Domain management, Add a domain you already own, `arohaseniorscharitabletrust.com`.
Then HTTPS, Verify DNS configuration, and let it provision the certificate.

The site is live, so deploy `site/` only (the live zip). `_redirects` sends the old
`aroha-seniors-preview.netlify.app` address to the domain. Don't deploy the old preview zip with its
`_headers` file again: it tells Google not to index the site.

## Search (SEO)

On the site (28/10/2026):

- Titles of about 60 characters or less with the trust's name and Auckland (Google cuts longer ones), and
  descriptions of about 160 characters or less.
- Canonical link on every page; `sitemap.xml` with dates; `robots.txt`; `404.html` (noindex, root links so it
  works at any address).
- Structured data: home has `WebSite` (site name) and `NGO` (also known as Aroha Seniors, Aroha Seniors
  Group, ASCT; charity number; contacts for Amelia and Korina; Flat Bush, South and East Auckland). Inner
  pages have breadcrumbs.
- `_redirects` 301s the netlify.app address to the domain, so Google sees one site.
- IndexNow key file (`/<indexnow_key>.txt`) so Bing and friends can be told about new pages straight away:

  ```
  curl -X POST https://api.indexnow.org/indexnow -H 'Content-Type: application/json' -d '{"host":"arohaseniorscharitabletrust.com","key":"<indexnow_key>","keyLocation":"https://arohaseniorscharitabletrust.com/<indexnow_key>.txt","urlList":["https://arohaseniorscharitabletrust.com/","https://arohaseniorscharitabletrust.com/about.html"]}'
  ```

Off the site, once:

1. Google Search Console: add a Domain property, verify with the TXT record in Cloudflare DNS, submit
   `sitemap.xml`, then URL inspection and Request indexing for the home page and About.
2. Bing Webmaster Tools: sign in and import from Search Console. Covers Bing, DuckDuckGo, Yahoo, Ecosia and ChatGPT search.
3. Google Business Profile: "Aroha Seniors Charitable Trust", category non-profit organisation, service
   area (Flat Bush, South and East Auckland) with the address hidden, website and Amelia's phone.
4. Links back to the site: website field on the Charities Register entry (Amelia, through Charities
   Services), the Facebook page's website field, and free listings on the Family Services Directory,
   Volunteering Auckland and Neighbourly.
5. Broad searches like "charitable trusts in Auckland" are owned by directories and big funders. Organic
   rank there takes months and links; Google Ad Grants is the quick way onto that page.

## Launch checklist

1. Confirm the items above with Amelia. Add photos and the bank account. Run `python3 build.py`.
2. Deploy the live zip to Netlify and attach the domain (above).
3. Wire `form_endpoint`, rebuild, and send a test enquiry from each form.
4. Add the website link to their Facebook page and Google Business Profile.
5. Optional: apply for Google Ad Grants through Google for Nonprofits. Registered NZ charities with a
   working website are generally eligible, but check current terms. If approved, LeadHive runs the account.
