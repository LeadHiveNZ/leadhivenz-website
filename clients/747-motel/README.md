# 747 Motel & Car Hire — website preview

Client: **747 Motel & Car Hire** (Booking.com lists it as "Wellington 747 Motel"), 80 Kilbirnie
Crescent, Kilbirnie, Wellington 6022. Manager Zafar Syed. Phone (04) 939 1747.
Status: **sales preview**, built 24/10/2026 to close the client. Not a lead-gen landing page from
the handyman template; this is a full motel site (rooms, offers, car hire, location, reviews).

## Files

| File | What |
|---|---|
| `index.html` | Home: hero, trust strip, availability widget, offers, rooms/car-hire tiles, guest segments, reviews, contact |
| `rooms.html` | Rooms & rates (all nine studios), availability widget, amenities |
| `offers.html` | The three offers plus the availability widget |
| `car-hire.html` | 747 Car Hire: how it works, the nine pick-up/drop-off locations, quote form |
| `gallery.html` | Photo grid with lightbox |
| `location.html` | Address, distances, Google map, who stays with us |
| `reviews.html` | Booking.com score block and guest quotes |
| `contact.html` | Phone, mobile, email, enquiry form, FAQ (with FAQPage JSON-LD) |
| `css/style.css`, `js/main.js` | shared styles and behaviour (menu, booking widget, modal, lightbox, reveal) |
| `img/` | the motel's own photos (current site + the Booking.com photo set), renamed and optimised, plus `logo.png` |
| `FACTS.md` | every fact used on the page with its source, and what is unconfirmed |
| `screens/` | full-page renders: `desktop.png`/`mobile.png` are the original one-page build; `pages/` has every page at 1440px and 390px |

Open `index.html` in a browser to preview; all pages link to each other with relative paths, so the
folder can be dropped on any static host as-is. Forms and the booking widget are visual only and
show a "preview" notice on submit. The original single-page build is in git history (commit 6efad42).

## What was reproduced from the current site (747motel.co.nz)

- All 9 room types and their "from" nightly rates ($59 compact, $115 first-floor studios,
  $125 ground-floor studios, $130 for the 3-sleeper units).
- Both live offers: "book direct, 10% off all rooms" and the Super Compact Studio
  stay-longer ladder (5% / 10% / 15%-off-a-rental-car with free WiFi + street parking).
- Business rates, guest segments (airport, Aquatic Centre, ASB Sports Centre, hospital,
  business, travellers), car hire pick-up/drop-off locations (Wellington, Wellington Airport,
  Auckland, Auckland Airport, Christchurch, Christchurch Airport, Picton, Picton Ferry, Queenstown).
- Colour scheme from the logo: lime #72BF44, red #B82126, ink #1F1A1A.

## Confirm with Zafar before anything goes live

- **Rates and offers** are from the current website, which is dated (copyright 2014, promo text
  from 2015–2016). Booking.com was showing roughly $65–$78 a night for King/Queen/Double on an
  aggregator at the time of build, so the website prices may be stale either way.
- **Booking.com score** shown as 7.8 from 48 reviews (staff 8.6, cleanliness 8.5, location 8.4),
  taken from search results on 24/10/2026. The property has more than one Booking.com listing with
  different scores (5.6 to 7.8); check the live listing before publishing.
- **Car hire fleet and daily rates** are not published anywhere. The page asks for a quote instead.
- **Check-in time** shown as 2pm (listings disagree: 12pm–3pm). Check-out 10am is consistent.
- **Email** wellington747motel@gmail.com from a directory listing; the site's own address is obfuscated.
- **Pets**: listings conflict, so the page says nothing about pets.
- **Booking engine**: the "check availability" widget needs wiring to whatever he uses (or a
  Booking.com deep link). Direct bookings are the whole pitch, so this is the first integration.

## Pitch notes

The current site is a 2014 WordPress/Bootstrap theme with expired promos, a credit-card field in a
plain HTML form, and no mobile layout. The preview is the same business, same prices, same offers,
same photos, presented like a 4-star property. Upsell path: booking engine integration, Google
Business Profile tidy-up, Google Ads for "motel near Wellington airport" and "car hire Wellington
airport" with direct-booking discount as the hook.
