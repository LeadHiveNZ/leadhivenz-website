# Aroha Campers — website

Static site: 5 HTML pages, one stylesheet, one JS file, images. No build step. Upload the whole folder to any host (Netlify, Vercel, cPanel, Lovable "import", Hostinger etc.) or open `index.html` locally to preview.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Main landing page: hero, how it works, what we buy, airport handover, why us, private sale vs Aroha, NZ-wide locations, FAQ, offer form |
| `sell-my-campervan.html` | Dedicated offer form page (send Google Ads / Facebook traffic here, or to `index.html`) |
| `faq.html` | Full FAQ with FAQ schema for Google rich results |
| `contact.html` | Phone, WhatsApp, Messenger, email, short contact form |
| `thank-you.html` | Shown after the form is sent. Use this URL as the Google Ads / Meta conversion page. `noindex`. |

## Before launch — edit `assets/js/site.js` (CONFIG block at the top)

```
phoneDisplay  "0800 20 30 60"   already set
phoneTel      "0800203060"      already set
whatsapp      ""                Ali's mobile in international format, e.g. "6421XXXXXXX". Blank = WhatsApp buttons hidden.
messenger     ""                e.g. "https://m.me/AROHA-PAGE-USERNAME". Blank = Messenger buttons hidden.
email         ""                e.g. "hello@arohacampers.co.nz". Shown on contact page, used as fallback.
formEndpoint  ""                see "Form" below. Blank = form opens the visitor's email app instead.
```

Also search-and-replace `https://www.arohacampers.co.nz` in every HTML file with the real domain (canonical + Open Graph + schema).

## Form

The forms post to `CONFIG.formEndpoint` as multipart form data (photos included). Two easy free/cheap options:

- **Formspree** — create a form at formspree.io, paste the endpoint (`https://formspree.io/f/xxxx`). File uploads need the paid tier; otherwise remove the photo field or keep it and the files are simply dropped.
- **Web3Forms** — endpoint `https://api.web3forms.com/submit`, put the access key in `web3formsKey`.

Both email the lead to whatever address you set up there. Successful sends redirect to `thank-you.html`.

If `formEndpoint` is blank, the submit button builds a pre-filled email (mailto) instead, so the site still works on day one.

## Tracking

Add Google Analytics / Google Ads tag / Meta Pixel just before `</head>` in each page. Track conversions on:
- `thank-you.html` page view (form lead)
- clicks on `a[data-tel]` (calls) — all phone links carry `data-tel`
- clicks on `a[data-wa]` / `a[data-msgr]`

For call tracking (e.g. Nimbata), the number appears in `<span data-phone>` elements and `a[data-tel]` links — swap in the JS CONFIG and the tracking number flows everywhere.

## Things to add once Ali has them

- **Reviews**: a commented-out "What sellers say" section is in `index.html`. Fill with real reviews (name, home country, van, city) and a Google rating once there are a few.
- **Motor Vehicle Trader registration** (MVTR number) in the footer if Ali is registered — strong trust signal, competitors use it.
- **Numbers**: "X vans bought", "Y years" — only once true.
- **Photos of Ali and real vans he has bought** — replace stock photos in `assets/img/`. Keep filenames and the site keeps working.
- **Resale page** later: add `campervans-for-sale.html` and a nav link in each header/footer.

## Images

Stock photos from Unsplash (free licence, no attribution required). Logo files: `logo-192.png`, `logo-512.png`, `logo-600.png` (transparent background), `favicon.png`, `og-image.jpg` (social share image).
