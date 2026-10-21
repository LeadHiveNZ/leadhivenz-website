# LeadHiveNZ Starter deck (NZ)

Sales deck for the $1,500 + GST Starter package. Built in the same HTML system as the
landing-page master templates (Inter Tight, `--paper` / `--card` / `--ink` / `--rule`
tokens, 14px cards, tick lists, numbered steps) with LeadHive navy and gold as the brand
accents.

```
LeadHiveNZ_Starter_Deck.html   the deck: 14 slides at 1600x900, open in any browser
LeadHiveNZ_Starter_Deck.pdf    the same deck printed to PDF (one slide per page)
assets/                        logo, Google ad shots, landing page shots, call tracking
                               shots and the client portal screens
portal-mock/                   the client portal screens rebuilt from the Lovable
                               project source (LeadHive Insights) with its demo partner
                               data, used to produce the portal screenshots
```

## Slides

1. Cover
2. The problem
3. How it works (4 steps)
4. Your ads, live (labelled)
5. Your landing page (labelled, current template: Northland + Tauranga Handyman)
6. Every call tracked (labelled, unchanged call tracking screens)
7. Client portal: home (labelled)
8. Client portal: leads and lead detail (labelled)
9. Client portal: monthly report (labelled)
10. Real results: Christchurch plumber, Auckland builder $20k, Wellington sparky $13k,
    with a "results, not a promise" note
11. The numbers that matter (ROI table against $1,500 + GST)
12. Your investment: Starter $1,500 + GST a month, $500 + GST setup
13. What happens when you sign up (6 steps, includes portal login)
14. Call to action

## Regenerate the PDF

```
chrome --headless=new --no-pdf-header-footer \
  --print-to-pdf=LeadHiveNZ_Starter_Deck.pdf LeadHiveNZ_Starter_Deck.html
```

The page size is set with `@page{size:1600px 900px}` in the HTML, so each slide is one page.

## Portal screenshots

The live portal needs a login, so the four partner screens (home, leads, lead detail,
monthly report) were rebuilt in `portal-mock/` from the portal's own components, styles
and demo partner data (Mike's Plumbing, September 2026). To swap in real screenshots,
replace the `*_first.png` and `*_s2.png` / `*_s3.png` files in `assets/` with captures at
390px wide (2x), then check the numbered pins on slides 7 to 9 still sit on the right
elements.

To rebuild the mock screens: `python3 portal-mock/build.py`, then screenshot each
`*.html` at 390x844 (first screen, body class `first`) or 390 wide full height (body
class `full`).
