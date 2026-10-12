# Aroha Seniors Charitable Trust — website

Client: **Aroha Seniors Charitable Trust** (registered charity **CC63126**), Flat Bush, Auckland.
Contact: **Amelia Kolio**, 022 178 0876, amelia_asct@outlook.com.
Meals on Wheels orders: **Korina Grace** (Kai Manager), 022 605 2361.
Lead: LeadHive website demo request, 12/10/2026 (Resend notification to hello@leadhivenz.com).

A five-page charity website in the trust's own branding: their heart logo, kawakawa green and
gold, their tagline "To serve with Aroha" and their values (manaakitanga, whanaungatanga,
kotahitanga).

```
build.py              run this after editing anything in src/ (standard-library Python only)
src/                  the source: layout.html, pages/*.html, styles.css, site.js
site/                 THE WEBSITE. Upload this folder to any host. One HTML file per page.
  index.html  about.html  what-we-do.html  get-involved.html  contact.html
  assets/styles.css  assets/site.js  assets/img/
preview/              the same five pages, each self-contained (CSS, JS, images inlined),
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

## The trust's own images (site/assets/img/)

Made from the two images Joe supplied on 12/10/2026 (their logo, and their banner with a photo of members doing poi).

| File                  | From                                   | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `logo-heart.png`      | Heart cut from the logo, transparent   | Header and footer of every page           |
| `favicon.png`, `apple-touch-icon.png` | Same heart             | Browser tab and phone home-screen icon    |
| `logo-full.jpg`       | Full logo                              | About page header                         |
| `banner.jpg`          | Full banner                            | About page, above the values              |
| `hero.jpg`            | Banner photo, three members with poi   | Home page hero                            |
| `gatherings.jpg`      | Banner photo, two members with poi     | What we do, Friendship gatherings         |

Photos Amelia sent on 12/10/2026 (her feedback round):

| File                  | Photo                                  | Used on                                   |
|-----------------------|----------------------------------------|-------------------------------------------|
| `group.jpg`           | Whole group in red and black ponchos   | Home "Who we are"; About gallery          |
| `mow.jpg`, `meals.jpg`| Two members with a cuppa and kai       | Home Meals on Wheels band; What we do, Meals on Wheels |
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

A headshot (woman in a red and black top) also came through but it's not clear who it is, so it
isn't used yet. Once Amelia confirms, save it as `amelia.jpg` or `korina.jpg` (square) and rebuild:
it replaces the initials on that person's card.

**More photos:** save JPGs in `site/assets/img/` with these names and run `python3 build.py`.
Each one replaces the illustration in its slot. Shape is portrait 4:5; on phones they crop to
landscape, so keep faces near the centre.
Still open: `digital.jpg`, `advice.jpg`, `amelia.jpg` and `korina.jpg` (square).

## Built for older readers

- **Text size control** (A / A+ / A++) in the top bar. The choice carries from page to page.
- Large type: 18px base, 56px+ buttons. Headings use Literata and body text uses Lexend. Both render
  te reo macrons correctly. Fraunces was dropped because its Google Fonts build misplaces macrons.
- Phone number in the top bar, hero, every call-to-action and the footer.
- Works without JavaScript: the mobile menu is a `<details>` element, links are plain pages, and the
  forms fall back to the visitor's email app. JavaScript only adds text size, animations and form posting.
- axe-core (WCAG 2.1 AA plus best practice): 0 violations on all five pages, desktop and mobile,
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

## Forms

Both forms (Get involved, Contact) post JSON to `form_endpoint` in `build.py`. When it's blank
(as now), they open the visitor's email app addressed to Amelia with the message filled in.
In Lovable, point it at the project's enquiry route (same Resend pattern as the trade sites) and add
amelia_asct@outlook.com as a recipient.

## Launch checklist

1. Confirm the items above with Amelia. Add photos and the bank account. Run `python3 build.py`.
2. Host `site/` (Netlify Drop, Lovable, or any static host). Attach their domain with HTTPS.
3. Wire `form_endpoint`, rebuild, and send a test enquiry from each form.
4. Add the website link to their Facebook page and Google Business Profile.
5. Optional: apply for Google Ad Grants through Google for Nonprofits. Registered NZ charities with a
   working website are generally eligible, but check current terms. If approved, LeadHive runs the account.
