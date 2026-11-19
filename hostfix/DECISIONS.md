# DECISIONS

What was decided outside the code, and what the code still has to catch up on.
Newest at the top. When a decision here contradicts a comment in the code, this
file wins and the code is wrong.

Written for whoever picks the work up next, human or agent. If you change a
price, a fee or a promise, add a line here saying what and why.

---

## 2026-11-20 — Parts: a fixed price list, the receipt plus 20%, and asking first

What the founder decided after a dispute stress-test (summarised): parts at cost with no fee left HostFix
paying the card fee on every part, gave tradies no reason to source well, and an owner disputing a part had
nothing to compare it with. So: a fixed price list for common parts, the merchant's price plus 20% for anything
else, receipts that only HostFix sees and checks, and the owner asked first above the no-ask limit. **This
replaces the old rule "parts are passed on at cost, no fee"** everywhere (AGENTS.md, pricing.ts, the terms,
the tradie agreement and pages, the price list email). Parts added before today stay at cost.

**The rules, as built** (`src/lib/jobs/parts.ts`, sums in `src/lib/jobs/pricing.ts`):

1. **Small parts up to `partsIncludedCents` (NZ$30) are in the price.** An off-list part at or under it is
   refused with that reason. Price-list parts are always charged, however cheap (a bulb is NZ$13).
2. **Price list** (`price_list_items`, per market, edited on More > Markets). A list part is charged at its
   list price, any quantity (1 to 50), with no receipt. Owner pays the list price; the tradie gets it less 3%
   (`LIST_PART_FEE_BPS`, rounded to the cent); HostFix keeps the 3%, which covers the card fee. Two GU10s at
   NZ$13: owner 2600, tradie 2522, HostFix 78.
3. **Off the list: receipt plus 20%.** The tradie enters what it is, the receipt total including GST, the
   amount of it for this job (packs, van stock), an optional receipt date, and uploads the receipt as a photo,
   a screenshot or a PDF from files (not camera-only). Owner pays amount x 1.20. The 15% fee is taken from the
   20% only: tradie gets amount + 17%, HostFix 3%. NZ$300: owner 360, tradie 351, HostFix 9.
4. **The receipt is seen only by staff (and the tradie who sent it).** The owner sees the part, the quantity,
   the price and "Receipt checked by HostFix" (or "Receipt to follow", or "HostFix is checking it").
5. **Ask first, on any job** (menu jobs too, from "Add parts", not only through a quote). If the job's parts
   stay within `partsApprovalCents` (NZ$150) and everything extra on the job stays within the property's
   overall limit (its own, or the market's NZ$600), they are added at once and the owner is texted ("Dave
   needs a tap cartridge, NZ$31.41, within your NZ$150 no-ask limit"). Above that, the owner approves on the
   job page with the existing quote buttons, before anything is bought. A quote is now for work only.
6. **Receipt to follow** is allowed at Job done (a tick). The owner is charged as normal; the tradie's payout
   is `held` (`src/lib/billing/holds.ts`, now shared with the 19 Nov job checks). The receipt can be added
   from the job page afterwards, which releases the payout if nothing else holds it. **After 7 days with no
   receipt the part is refunded to the owner automatically** (a Stripe refund with its own idempotency key; if
   the card had not been charged yet, it simply comes off the charge), the tradie's payout drops by their
   share of it, both are texted, and the rest is released.
7. **Receipt checks go straight to the queue** ("Check a parts receipt", one-tap Approve or Hold on the queue
   and the job page) and hold the payout: a receipt dated more than 90 days before the job (from the date the
   tradie enters; reading a date out of a receipt photo or PDF was not cheap or reliable, so it is not done);
   an amount for the job over the receipt's total; the same receipt (the same file by its SHA-256
   fingerprint, or the same tradie, total and date) used on jobs that together claim more than its total.
   Hold texts the tradie neutrally.
8. **Cancelled after approving work:** parts already bought that cannot go back are charged at the receipt's
   cost, no markup, all to the tradie, by staff on the job page ("Charge parts bought before it was
   cancelled"), once per job.
9. **Words** (owner terms, owner and tradie landing copy, tradie agreement, price list email, owner job page),
   from `partsWords`: "Small parts up to $30 are in the price. Common parts are on the price list at a fixed
   price. Anything else is charged at the merchant's price plus 20% for sourcing it." Prices include GST.
   Never "retail". Owner-supplied parts: no parts charge, and a fault in them is not covered by the tradie's
   30-day callback. A faulty part the tradie supplied: they handle the supplier warranty; labour under the
   30-day callback. RUNBOOK: fitted parts are not refunded unless removed.

**The price list, as loaded** (`seed/parts-queenstown.json`, once, into an empty list). **Check every price
with the first tradies.** Both retailers refused automated visits (HTTP 403) on 19 Nov 2026, so each price was
read from the web search engine's copy of the product or category page named, not from the page itself.

| Code | Part | Price (incl. GST) | Source (19 Nov 2026) |
| --- | --- | --- | --- |
| PSA-01 | Smoke alarm, photoelectric, 10-year battery | NZ$39.98 | Bunnings NZ, Family Shield 10 year round mini, https://www.bunnings.co.nz/brands/f/family-shield |
| PTP-01 | Tap washer kit | NZ$11.73 | Bunnings NZ, FIX-A-TAP Assorted Washer Kit 26 pack, https://www.bunnings.co.nz/fix-a-tap-assorted-washer-kit-26-pack_p0137789 |
| PTP-02 | Mixer tap cartridge (40 mm) | NZ$31.41 | Bunnings NZ, FIX-A-TAP 40mm Flat Mixer Tap Cartridge, https://www.bunnings.co.nz/fix-a-tap-40mm-flat-mixer-tap-cartridge_p0272017 |
| PTL-01 | Toilet cistern inlet valve | NZ$26.24 | Bunnings NZ, FIX-A-LOO Hush Fill Cistern Inlet Valve, https://www.bunnings.co.nz/fix-a-loo-hush-fill-cistern-inlet-valve_p0422772 |
| PTL-02 | Toilet flush valve and button (dual flush) | NZ$65.75 | Bunnings NZ, Fluidmaster Dual Flush Toilet Cistern Valve and Button, https://www.bunnings.co.nz/fluidmaster-dual-flush-toilet-cistern-valve-and-button_p0281419 |
| PTL-03 | Toilet seat, soft close | NZ$75.61 | Bunnings NZ, Hydrowater White Bianco Soft Close, https://www.bunnings.co.nz/hydrowater-white-bianco-soft-close-toilet-seat_p0174335 |
| PSH-01 | Shower head, fixed | NZ$117.00 | Mitre 10 NZ, Felton Shower Head 65mm Chrome SKU 156035, https://www.mitre10.co.nz/shop/felton-shower-head-w-65mm-dia-d-125mm-chrome/p/156035 |
| PLT-01 | LED bulb, bayonet (each) | NZ$15.93 | Bunnings NZ, Philips A60 B22 1700lm 14.5W, https://www.bunnings.co.nz/products/lighting-electrical/light-bulbs-globes/bayonet-cap-globes |
| PLT-02 | GU10 LED downlight bulb (each) | NZ$13.00 | Bunnings NZ, Osram GU10 495lm 5W dimmable, https://www.bunnings.co.nz/products/lighting/light-bulbs-globes/downlights |
| PEL-01 | Double power point | NZ$15.13 | Bunnings NZ, DETA 10A Wide Spaced Double Power Point, https://www.bunnings.co.nz/deta-10a-wide-spaced-double-power-point_p0310613 |
| PEL-02 | Light switch, single | NZ$14.44 | Bunnings NZ, HPM 1 Gang Light Switch White, https://www.bunnings.co.nz/hpm-1-gang-light-switch-white_p0607148 |

Not on it: none of the ten asked for was left out, but two are worth a second look. The fixed shower head is the
one listing whose price was quoted exactly; cheaper heads (about NZ$43 to NZ$65) appeared only as approximate
figures, so they were not used. The cistern inlet valve is a bottom-entry model; side-entry valves cost more
(about NZ$52 to NZ$60). "Tap cartridge or washer kit" became two parts.

**Worked example on PL-01 (owner 22500, tradie 19000), all by hand in `tests/unit/parts.test.ts`:**

| What was added | Owner pays | Tradie gets | HostFix keeps |
| --- | --- | --- | --- |
| Mixer cartridge 3141 + inlet valve 2624 (no asking) | 22500 + 5765 = 28265 | 19000 + 3047 + 2545 = 24592 | 3500 + 94 + 79 = 3673 |
| NZ$300 off the list (over NZ$150: owner approved) | 22500 + 36000 = 58500 | 19000 + 35100 = 54100 | 3500 + 900 = 4400 |
| NZ$100 off the list, receipt never came | 34500 charged, 12000 refunded | 30700 - 11700 = 19000 | 3500 |
| Cancelled after approval, NZ$86.50 of parts bought | 8650 | 8650 | 0 |

**What changed:** migration `20261126000000_parts.sql` (adds only: `price_list_items`, `job_parts`, a file
fingerprint on uploads, `part_id` on job lines, the queue kind `receipt_check`, and the four menu notes that
said "at cost", changed only where they still read exactly as loaded); `seed/parts-queenstown.json` and
`seedPriceList` (seed-core, once per market, remembered in `app_state`); `pricing.ts` (quotes are labour
only; `listPartLine`, `receiptPartLine`, `partsApproval`); `parts.ts`; `holds.ts` (used by `openSettlement`
and the 19 Nov checks); `work.ts` (quotes, Job done, could not get in); `create.ts` (cancelling voids pending
parts); `settle.ts` (texts for a cancelled job's parts); the timer; the upload route (fingerprints, PDFs); the
photo uploader (photo or PDF); the tradie, owner and staff job pages; the queue; the Markets admin screen; texts
(`partsAdded`, `partsNeedApproval`, `receiptCheckHeld`, `receiptMissingTradie`, `receiptMissingOwner`,
`boughtPartsCharged`); terms (section 3), tradie agreement (5, 6), both landing pages, the price list email
and page (with the parts list), RUNBOOK, AGENTS.md, the demo (a list part on job 4; the quote on job 5 is now
NZ$685 of work).

**Decided while building, to confirm:**

- Price-list parts are charged even under NZ$30; the NZ$30 rule only stops off-list parts. Otherwise a NZ$13
  bulb on the list could never be charged.
- "The property's overall approval limit" counts everything extra on the job: approved quotes and all parts.
- Parts and a work quote are asked about separately; only one request can wait for the owner at a time.
- The receipt is visible to the tradie who sent it as well as staff (it is their own document). Never to the owner.
- A receipt-to-follow refund comes off the tradie's payout; if the owner's card had not been charged yet, it
  comes off the charge instead.
- The "amount over the receipt" and "receipt used twice" checks flag rather than refuse, as asked; the team
  decides.
- "Could not get in" takes every part off the job, the same as every other line.

**Not ours to change:** the live landing pages (`hostfix-landing/`, Lovable) still say "Bigger parts go to the
owner at cost when you add them to the job with the receipt" (`src/HostFixTradies.tsx`, the "Parts?" answer).

---

## 2026-11-19 — Checking that a job was really done, without the founder looking at every one

What the founder decided (summarised from his brief, not his exact words): stop a tradie tapping
"Arrived", photographing his shoe, tapping "Finished" and getting paid, without Joe reviewing every
job. A map pin for every property; the location checked at Arrived and at Finished; before and after
photos taken in the app; a minimum time on site; and the owner, not the team, asked first about a job
the app could not confirm. Only what is left goes to the dispatcher. Declining still never counts.

**The rules, as built:**

1. **A map pin for every property** (`src/lib/properties/pin.ts`). Adding a property, changing its
   street address or pasting a spreadsheet looks the address up and puts the pin there
   (`looked_up`). The property page shows it on a small map; the owner drags it, taps the map or uses
   "I'm at the property now", and presses "Yes, the pin is on the house" (`owner_moved` if they moved
   it). Until they do, the property list and page ask them to. A pasted spreadsheet is looked up 25 at
   once and the timer finishes the rest, ten a minute. A new street address clears the old pin.
2. **The location is checked at Arrived and at Job done** (`src/lib/jobs/checks.ts`), against the pin;
   with no pin, against the middle of earlier trusted arrivals (the 18 Nov rule); with neither, against
   this job's own Arrived tap at Job done. **Over 300 m, or no location, is a flag** (was 500 m; the pin
   is far more exact than the median). The tap is never refused. Both distances are on the job.
3. **Before and after photos in the app.** Arrived needs at least one "before" photo (a new upload kind)
   and Job done at least one "after" photo; "could not get in" keeps its photo rule. The photo button opens
   the camera (`capture="environment"`, one at a time). **Honestly: some phones still offer the gallery
   from the camera screen**, and a browser on a computer always does. Each photo is stamped with the
   server's time and the phone's location. The phone reads the photo's own date (EXIF DateTimeOriginal,
   with no extra library, `src/lib/files/exif.ts`) before shrinking it, and a date 30 minutes or more
   before the job was logged is a flag. A screenshot or saved image has no date, so no date is not a flag.
4. **Time on site.** Job done less than `min_minutes_on_site` (a market setting, 10) after Arrived is a
   flag. Diagnosis jobs, off-menu (look-and-price) jobs and "could not get in" are exempt. 0 switches it off.
5. **Who checks a flagged job.** No flags: paid exactly as before. Flagged: the owner's card is charged as
   normal, the tradie's payout is **held** (a new payout status), and the "job done" text asks the owner,
   in neutral words ("We couldn't confirm the tradie's location for this job. Can you check the photos and
   confirm it's fixed?"), linking to the job page, where the before and after photos sit side by side with
   **Yes, it's fixed** and **Something's wrong** (buttons; the link only opens the page).
   - Yes: the payout is released, due at its usual time (24 hours after the job) or now if later.
   - Something's wrong: the existing dispute (payout paused, dispatcher's queue).
   - No answer in `owner_confirm_hours` (a market setting, 48): a **trusted** tradie (10 or more finished
     jobs before this one, and no other flagged job in the last 90 days) is paid and the flag stays on the
     record; anyone else goes to the queue as **Check a job, then pay or hold**, with one-tap Approve and Hold
     on the queue and the job page. Hold texts the tradie, neutrally, that the payment is on hold.
   - **3 flagged jobs in 90 days** shows the tradie for review on the admin tradie page and list, and puts
     **Tradie's jobs keep being flagged** in the queue. Nothing is changed on their account.
   - Only jobs a tradie accepted and finished are checked. A test proves 12 passes and a lapsed offer
     create no flag and change nothing.
6. **Tradie agreement:** a job reported as done that was not done, including faked location or photos,
   means removal, and any money paid for it **must be repaid**. Clawback from future payouts was not
   practical: `settle.ts` has no step that takes money off a later payout. What it does have is a Stripe
   transfer reversal when a dispute ends in a refund, so section 7 now says that, and "if that cannot be
   done, you agree to repay it" (it previously promised "from your next payments", which the code never did).
   Owner terms (section 8) say a flagged job's payment may be held for the owner to confirm.

**What the dispatcher's queue sees now, and an estimate of the load.** Only: an owner saying something
is wrong (as before), a flagged job whose owner was silent for 48 hours and whose tradie is not yet
trusted, and a tradie with 3 flagged jobs in 90 days. An Arrived tap with no location or far away **no
longer** raises "Arrival not confirmed" by itself (the owner still has "The tradie isn't here"). Estimate,
on assumptions, not measurements: at 150 jobs a month (about 100 properties), if 10 to 15% are flagged
(phones refusing location, small menu jobs done fast), that is 15 to 25 owner questions a month. If two in
three owners answer, 5 to 8 go unanswered; once the regular tradies pass 10 jobs, perhaps half of those
are trusted, so **about 3 to 4 "check a job" items a month, plus disputes and the odd repeat offender:
roughly one a week**, against about 25 a month if every flagged tap went to the queue. Measure it after a
month: the admin job pages show every flag, and the audit log has `job.flagged`.

**The map service, and what it costs.** Researched in each provider's current documentation, 19 Nov 2026.

| Option | What it costs | Why not, or why |
| --- | --- | --- |
| **LINZ Data Service, "NZ Addresses"** (chosen, for the lookup) | **Free.** A free account and API key; the data is CC BY 4.0 | The government's own address points for New Zealand. Called by the server (WFS GetFeature with a `full_address ILIKE` filter). `LINZ_DATA_KEY`. No published request limit was found; the app sends one request per property, plus a few a minute from the timer. |
| **LINZ Basemaps aerial photos** (chosen, for the map) | **Free.** A "developer" key (ask LINZ) never expires and has no limit; the standard key expires after 90 days and allows 1,000 tiles a minute and 1,000,000 a month | Aerial photos, so the owner puts the pin on their own roof. Must show "LINZ CC BY 4.0 © Imagery Basemap contributors". `LINZ_BASEMAPS_KEY`. |
| OpenStreetMap tiles (the fallback map) | Free | Allowed for light use with the "© OpenStreetMap contributors" credit shown; may be blocked without notice if use degrades the service. Used only when no Basemaps key is set. |
| OpenStreetMap Nominatim | Free | Not used: one request a second for everyone, no autocomplete, bulk lookups (a spreadsheet import) discouraged. |
| Google Geocoding | US$5 per 1,000 after 10,000 free a month (third-party summaries of the March 2025 pricing; a billing account is needed) | A paid service: Joe approves those first. Not needed. |
| Mapbox | Storing a result needs "permanent" geocoding, which has no free tier | Paid. |
| Addressfinder | From about A$19 a month for 200 lookups (their plans page); 30-day trial | Paid. |

Nothing was signed up for. With no keys the app still works: no lookup, OpenStreetMap's street map, and
the owner places the pin. The map itself is Leaflet 1.9.4 (BSD licence, a new dependency of about 40 kB compressed),
loaded only on the property page.

**What changed:** migration `20261125000000_job_checks.sql` (adds only: two market settings and a map
centre, the property pin columns, the job check columns, photo stamps and the "before" kind, the `held`
payout status, two queue kinds); `src/lib/jobs/checks.ts`, `src/lib/jobs/confirm.ts`,
`src/lib/properties/pin.ts`, `src/lib/maps/geocode.ts`, `src/lib/maps/tiles.ts`, `src/lib/files/exif.ts`;
`markArrived` and `finish` in `work.ts`; `openSettlement`, `chargeJob` and `raiseDispute` in `settle.ts`;
`reliability.ts` (trust and flag counts); the timer; the upload route; the photo uploader and located
buttons; the owner's, tradie's and team's job pages; the queue; the admin tradie and market pages; the
property pages and import; the texts (`jobCheck`, `payoutCheckHeld`); the terms (6, 8), privacy, tradie
agreement (4, 6, 7, 8, 11), the landing copy; SETUP.md (step 7b), the setup checklist, the demo (pins, before
photos, and one flagged job waiting for its owner) and AGENTS.md.

**Decided while building, to confirm:**

- A looked-up pin counts as the reference before the owner confirms it. LINZ address points are the
  official position of each address; waiting for every owner would leave pasted properties unchecked.
- "10 or more finished jobs" means before this one, with any outcome ("could not get in" included).
- "Diagnosis/quote jobs" was read as every off-menu (look-and-price) job, even when a quote was then
  approved and done, a diagnosis-only outcome, and the menu's five diagnosis jobs (PL-06, EL-02, EL-03,
  HP-03, AP-01). The database does not store the menu file's "isDiagnosis" mark, so these are known by
  "diagnosis" in their name (`isDiagnosisJob`, `src/lib/jobs/checks.ts`); renaming one on the admin screen
  would bring it under the 10-minute rule.
- The owner's card is still charged straight away on a flagged job; only the tradie's payout waits. A
  refund then goes through the dispute as before.
- Released payouts keep the usual 24-hour hold: an owner who says yes after 1 hour does not make the
  tradie's money go sooner than a clean job's.
- After Hold, the queue item is closed with a note; the job page keeps the Approve button, and the payment
  stays held until someone presses it or the owner raises a problem.
- A stale photo is one dated 30 minutes or more before the job was logged (room for phone clocks).
- Flags are decided at Job done, from both taps. "No location" at Arrived alone no longer reaches the
  dispatcher during the job.

---

## 2026-11-18 — Missing the time no longer costs HostFix; the owner pays for what actually happened

What the founder decided (summarised from his brief, not his exact words):
HostFix should not lose its margin because a tradie is unreliable, so the rule
"miss the promised time and the call-out portion of that job is on us" goes.
Instead the owner never pays for speed that was not delivered, and a tradie's
own on-time record on the jobs they accept decides who is offered work first.
Declining a job must never count against a tradie: it protects their standing
as contractors. Added the same day for the owner's chosen tradies (the first
choice and backup): besides Accept and Pass they can suggest a later time, up to
7 days ahead, and the owner chooses to wait or send it to another HostFix tradie
now. When a chosen tradie passes, the owner is never told "passed" or "declined".

**Why.** The old credit put HostFix's margin (NZ$35 on a NZ$225 job) behind a
tradie's punctuality, which HostFix does not control: one late tradie could wipe
out several jobs' fees. The new rules keep the owner whole in a way that costs
HostFix nothing: they are not charged for a speed they did not get, and they
pay nothing at all unless a tradie does the job. Reliability is rewarded with
work, measured only on jobs a tradie chose to accept, so nobody is penalised for
saying no.

**The rules, as built:**

1. **No more missed-window credit.** `creditMissedWindows` is now
   `markMissedWindows` (`src/lib/billing/settle.ts`): it still sets
   `window_missed_at` and raises the queue item, and creates no credit and no
   owner text. Old rows are left alone. **Chosen for credits already pending:**
   a `missed_window` credit made before today still comes off its own job's
   charge in `openSettlement`, because the owner was told it would. No new ones
   can be made (nothing inserts them any more). Statements and the admin owner
   page still show the old ones, labelled as from before this change.
2. **Late on an urgent job, no urgent line for anyone.** When the tradie taps
   Arrived after the job's `respond_by` (the urgent deadline, the tier's
   `urgentResponseHours` from when the job was sent out, the same clock as
   before), the urgent line is voided: the owner pays 0, the tradie gets 0,
   HostFix keeps 0. The rest of the job is charged and paid as normal. On a tier
   that includes urgent, the tradie's share goes too. The offer text says "NZ$42.50
   of it only if on site by 2pm today", and the offer page says it in full.
3. **After hours is charged for what happened.** The after-hours line stays only
   if the Arrived tap is outside the market's working hours (`isAfterHours`:
   before 7am, from 4:30pm, or a day that is not a working day). The decision is
   made at Arrived (`markArrived`, `src/lib/jobs/arrival.ts`), not at finish or
   settle, so the owner sees the final lines on the job page, with a history line
   saying why ("No urgent fee: not charged, because the tradie arrived after the
   urgent deadline"), before the card is charged at the end, as now.
4. **Arrived taps that cannot be trusted are flagged.** Properties have no map
   position and no geocoding service was added. The reference is the median of
   earlier trusted Arrived taps at the same property (ones checked `ok` or
   `no_reference` that the owner did not dispute). No location, or more than
   500 m from the reference, raises **Arrival not confirmed** in the queue. The
   first visit with a location is recorded as "no reference yet" and raises
   nothing. The owner's "has arrived" text now links to the job page, which has a
   **The tradie isn't here** button (a button, never a link that acts), raising
   **Owner says the tradie isn't there** (texted to the founder too).
5. **The tradie picks an arrival window when accepting a normal job.** Two-hour
   windows inside working hours (by the wall clock, any day of the week, the last
   one ending at 4:30pm), ending inside the promise; one under way starts now.
   If none fits, the one choice is "any time before the promise". Stored on
   `jobs.arrival_window_start/end`; texted to the owner ("on site between 1pm and
   3pm today") and to the cleaner or guest who reported it, and shown on the job
   pages. On time for a normal job means arrived by the window's end. An urgent
   job's window is its deadline. The text link still only opens a page; each
   window is a button, and pressing one accepts.
6. **Nobody accepted within 3 hours** (normal jobs, counted from when it was sent
   out): the owner is texted "no tradie has taken the job yet. Our team is ringing
   round now. You pay nothing unless a tradie does the job", and **Nobody has
   taken it yet** goes to the queue and the founder's phone. A market setting,
   `unaccepted_alert_hours`, default 3 (More > Markets). Urgent jobs keep their
   own alerts.
7. **The on-time record decides network order.** After 10 arrivals, a tradie with
   fewer than 90% of their last 20 arrivals on time is offered network ("everyone
   else") jobs in a second wave, after the others' 15 minutes. They still get the
   offer. The first choice and backup are never moved by this. **Declining never
   counts**: passes and offers left to run out are not in the record, the 30-day
   scorecard no longer has an acceptance number, and the first-choice swap prompt
   uses on-time only. A test proves 12 passes change nothing.
8. **No-shows.** An accepted job with nobody on site by the promised time raises
   **Tradie not there: call them**. At 3 no-shows in 90 days the tradie is flagged
   on the admin tradie page and list, and **Tradie to talk to** goes to the queue.
   Nothing is changed on their account: removal stays a staff action.
9. **"Can't make that time, suggest another"** (first choice and backup only).
   From the offer page they pick a later two-hour window up to 7 days ahead. The
   owner is texted and chooses on the job page: **Wait for them** or **Send it to
   another HostFix tradie now**. Waiting makes the tradie's window the promise
   (`respond_by`), so on time, no-shows and at-risk are judged against it; an
   urgent job stops being urgent and its urgent and after-hours lines come off for
   everyone. Sending it on, or no answer within `counter_offer_hours` (a market
   setting, default 2), moves the job to the next tradie as normal and texts the
   chosen tradie "this never counts against you". While the owner is choosing,
   the cascade and the 3-hour alert wait. When a chosen tradie passes, the owner's
   job page says "Name isn't available for this one, so we've sent it to another
   HostFix tradie."

**Worked example: PL-01, owner 22500, tradie 19000, an urgent job logged at 10am
Monday (deadline 2pm).**

| What happened | Owner pays | Tradie gets | HostFix keeps |
| --- | --- | --- | --- |
| Arrived 1:59pm (on time) | 22500 + 5000 = 27500 | 19000 + 4250 = 23250 | 3500 + 750 = 4250 |
| Arrived 2:01pm (late) | 22500 + 0 = 22500 | 19000 + 0 = 19000 | 3500 + 0 = 3500 |
| Logged 9pm, arrived 10pm | 22500 + 5000 + 14000 = 41500 | 19000 + 4250 + 11900 = 35150 | 6350 |
| Logged 6:30am, arrived 7:15am | 22500 + 5000 = 27500 (no after hours) | 23250 | 4250 |
| Owner chose to wait for a later time | 22500 | 19000 | 3500 |

**What changed:** migration `20261124000000_on_time.sql` (adds only: the two
market settings, the job columns, `arrival_proposals`, new queue kinds);
`src/lib/jobs/arrival.ts`, `src/lib/tradies/reliability.ts`, `markArrived` and
`reportTradieAbsent` (`work.ts`), the cascade (`acceptOffer` with a window, the
second wave, `suggestLaterTime`, `answerLaterTime`, `expireLaterTimes`,
`alertNotTakenYet`), the timer, the texts, the offer page, the tradie's home,
the owner's job page, the admin job, tradie and market pages, statements, the
terms (section 4, and section 3 on after hours), the tradie agreement (sections
3, 4, 6, 8 and 11), the owner and tradie landing copy, the home page, the price
list, the runbook, AGENTS.md and docs/PLAN.md. Fee percentages, menu prices and
surcharge amounts are unchanged.

**Decided while building, to confirm:**

- An after-hours line is only ever removed, never added: a normal job attended at
  night does not gain one, because the owner never agreed to it.
- When the owner waits on an urgent job, the after-hours line goes as well as the
  urgent one: both only exist because the job was urgent.
- A no-show is counted when the promised time passes with the tradie not there,
  even if they turn up later. Being late to their own window but inside the
  promise is "not on time" (it counts in the record) but not a no-show.
- The network-order record is the tradie's last 20 arrivals, all trades, all time,
  so a tradie can earn their place back. 10 arrivals before it applies.
- A text YES reply, or a job the team assigns, has no window: the promise is the
  deadline. The tradie's home page asks for the window in a drop-down before
  Accept.
- The 3 hours are counted from when the job was sent out, so a guest report waiting
  for the owner's yes is not counted.
- **Quiet hours (added the same day).** The two new owner texts, "nobody has
  taken it yet" and a chosen tradie's later time, are never sent between 9pm and
  7am market time: they are held and go at 7am. The queue item still appears at
  once. On a normal job the 3-hour and 2-hour clocks count only 7am to 9pm, so a
  job logged at 7pm alerts at 8am, and a later time suggested at 10pm is texted at
  7am with until 9am to answer. Urgent jobs are unchanged: any time, plain clock.
  7am and 9pm are their own constants (`TEXTING_STARTS`, `TEXTING_ENDS` in
  `src/lib/time.ts`), not the market's working hours (7am to 4:30pm), because
  when tradies work and when it is fine to text an owner are different questions.
  Other texts are not held (none were before).
- The terms read the 3 and 2 hours from the launch market's settings
  (`config/markets.ts`), and the tradie agreement reads its limits (10, 90%, 20,
  3 in 90 days, 7 days, the window length) from the code's constants.
  `tests/unit/legal.test.ts` fails if they, the market defaults and the
  database's column defaults disagree. An admin changing the hours for a market
  on the Markets screen still needs the terms changed by hand.
- The dispatcher still cannot move an accepted job to another tradie from a screen;
  for a no-show they cancel and log it again.
- The owner's "isn't available" line is on the job page's history, not a text.
- The terms and the tradie agreement keep the date 18 November 2026. Tradies who
  agreed before today have not re-agreed to the new sections.

Built on 2026-11-18: all of the above.

---

## 2026-11-18 — A cleaner is a person, not a link

The founder, in his words:

> "A cleaner is a person, not a link. The owner adds a cleaner by name and
> mobile number and ticks the properties they look after, and the cleaner gets
> one link for life that shows the list of houses they may report on, across
> every owner who has added that number. A forwarded link opens nothing until
> the phone proves the number with a six-digit text code, once. Unticking the
> cleaner removes the house from their list. Every report is signed with the
> cleaner's name. Owners can put properties into named groups and assign a
> cleaner to a group, so a property added to the group later is covered
> automatically. The guest QR card stays per property and anonymous. A manager
> can print every QR card at once and can paste a spreadsheet of properties in."

**What was built:**

- **Tables** (migration `20261123000000_team.sql`, safe to run twice, Row Level
  Security on with no policies): `team_links`, one per person (a user, known by
  their mobile) holding their one link; `team_members`, one per owner per person,
  with the name that owner knows them by and their setting; `property_groups` and
  `property_group_members`; `team_access`, which properties and groups each team
  member may report on; and `jobs.team_member_id`. Adding, changing and removing
  a team member, and making, changing and deleting a group, each write their
  audit entry in the same database step (`team.added`, `team.properties_changed`,
  `team.removed`, `group.created`, `group.changed`, `group.deleted`).
- **The owner's side** (`/app/team`, one tap from Properties, and the **Add a
  cleaner** button on each property page): **Add a cleaner or co-host** with name,
  mobile, the houses to tick, and **Send a tradie straight away** or **Ask me
  first**. The app texts them their link. Each person's page shows their link to
  copy, lets the owner change everything but the mobile, and **Take off my team**.
  Groups (create, rename, add and remove houses, delete) appear only for owners
  with 3 or more properties.
- **The cleaner's link** (`/r/<link>`, `src/lib/team/`): on a phone without the
  `hf_team` cookie it shows only "Text me the code" to a masked mobile. The code
  is the same six-digit sign-in code (10 minutes, 5 tries). Right, and the phone
  gets a cookie for about a year (the most a browser keeps one), signed against
  the link. Then it lists their houses across every owner (name, suburb, and the
  owner's first name when there is more than one owner), and the usual report
  form for the chosen one, with no name box: "Sent as Mele". Only covered
  properties appear.
- **Signed with their name**: the job's reporter is the name the owner gave them
  and their mobile, `team_member_id` is set, the audit actor is `team:<id>`, the
  owner's text says "Mele logged ..." (or, for **Ask me first**, the new
  `team_report` text "Mele reported ... You asked to say yes first. Send
  someone?"), and the owner and admin job pages say "Mele reported this from
  their team link". An "ask first" report waits like a guest's and never commits
  the owner to urgent; "Mele says this is urgent" is put in the description.
- **The older per-property team link keeps working** for anyone who has it. The
  property page no longer offers it once the owner has anyone on their team; until
  then it sits under "Or share this property's link", behind **Add a cleaner**.
- **Print every QR card** (`/app/properties/cards`): every covered property's
  guest card, one to a printed page, from the same markup as the single card.
- **Add many at once** (`/app/properties/import`): one box, one property per line
  (name, street, suburb, postcode, access notes; tabs or commas; a heading line
  is skipped), a table that checks every line before saving, at most 200 lines.
  Lines without a problem are saved in one database step, each through
  `createProperty`, so Portfolio and the audit log work as usual; with a card on
  file each is covered straight away, as "Cover this property" would.
- **Demo**: Sam has Mele on his team with both his houses, job 1 is signed by her,
  and the demo menu has **Mele (cleaner) > Be them** (straight to her houses) and
  **Mele's link, forwarded** (the code screen).
- **Words**: terms section 5 and the privacy statement say what is held about a
  team member and who can send a tradie (both dated 18 November 2026); the owner
  page's "How it works", README, RUNBOOK, TRY-IT and AGENTS.md.

**Decided while building, to confirm:**

- "Default to the property's team setting today": the per-property team link
  always sent a tradie straight away, so **Send a tradie straight away** is the
  default.
- A report is signed with the name the owner typed, not a name the cleaner
  chose, so each owner sees the name they know. Two owners can call the same
  person different names.
- A property can be in more than one group. Deleting a group keeps its houses.
- Re-adding someone after **Take off my team** reuses the same record, so old jobs
  still show who reported them, and texts them their link again.
- The owner cannot change a team member's mobile; they take them off and add the
  new number. Nobody, staff included, can replace a person's link from a screen
  yet (it would need a button for staff).
- A cleaner whose mobile is on the team is a user without an owner account. If
  they later sign up as an owner with that mobile they are told it already has
  an account; staff would need to make them an owner by hand.
- Imported properties go into the market chosen on the import page (the first
  open one by default), on the membership the Add a property form starts on.

Built on 2026-11-18: all of the above.

---

## 2026-11-18 — Urgent is NZ$50, and both surcharges carry the 15% fee

The founder, in his words:

> "The daytime urgent fee is too high: during business hours most firms do not
> charge a same-day premium, so a local owner can beat NZ$90 by ringing round.
> Urgent (within 4 hours) drops to NZ$50 and is described as what it buys: the
> tradie drops what they are doing. After hours stays NZ$140. HostFix takes its
> 15% on both surcharges, the same as on every other dollar; they no longer go
> to the tradie in full. The tradie still gets the urgent and after-hours money
> on top of their menu share, and urgent work is still never discounted."

**Worked example: the dripping tap (PL-03), NZ$235 on the menu (owner 23500 cents, tradie 20000).**
15% of 5000 is 750 and 15% of 14000 is 2100, both exact.

| The job | Owner pays | Tradie gets | HostFix keeps |
| --- | --- | --- | --- |
| Booked, no surcharge | 23500 | 20000 | 3500 |
| Urgent | 23500 + 5000 = 28500 | 20000 + 4250 = 24250 | 3500 + 750 = 4250 |
| After hours | 23500 + 14000 = 37500 | 20000 + 11900 = 31900 | 3500 + 2100 = 5600 |
| Urgent and after hours | 23500 + 5000 + 14000 = 42500 | 20000 + 4250 + 11900 = 36150 | 6350 |

A surcharge that does not divide evenly rounds the fee to the nearest cent
(3333 cents: fee 499.95, so 500; the tradie gets 2833).

**What changed:**

- **Queenstown urgent is NZ$50** (5000 cents): `config/markets.ts`,
  `seed/menu-queenstown.json`, the default for a new market copied from nothing
  (`src/lib/markets/admin.ts`), and migration `20261122000000_urgent_fifty.sql`,
  which changes the Queenstown row only while it still says 9000, so a second
  run, or a price the admin has since set by hand, is left alone.
- **Jobs already logged keep what they were quoted.** Each job's prices are
  copied onto its own lines when it is logged; the migration does not touch
  them, and a test proves a later market change does not move a logged job.
- **The fee applies to surcharges** (`surchargeShare` in `src/lib/jobs/pricing.ts`):
  the urgent and after-hours lines give the tradie the surcharge less
  `platformFee(cents, market.platformFeeBps)`, in whole cents. Refund splits,
  the missed-promise credit, statements and payouts already work from each
  job's lines, so they follow without change. Parts stay at cost, no fee.
- **The tradie's offer text shows their share** (it always used the job's
  tradie total): an urgent PL-01 now reads "Pays NZ$232.50" (19000 + 4250).
- **Words:** the report screen's choice is now "Get someone there within 4
  hours", "The tradie drops what they are doing to come. NZ$50 more.", with
  the after-hours amount on its own line, all read from the market. Changed:
  the price list (email and thank-you page), the owner page and its proof line,
  the tradie page (now "Urgent adds NZ$42.50 to your pay and after hours adds
  NZ$119"), the terms (section 3), the tradie agreement (section 6, "Pay"), the
  tradie's job screen and profile, the admin Markets screen hints, AGENTS.md,
  docs/PLAN.md, docs/TRY-IT.md, docs/DEMAND-TEST.md and docs/LEGAL-TODO.md.
  Three new placeholders for the landing copy: `{{urgent_share}}`,
  `{{after_hours_share}}`, and `{{platform_fee}}`.

**Decided while building, to confirm:**

- A membership that includes urgent (none is sold today) now costs the platform
  the tradie's share, 4250, not the whole 5000.
- The owner terms now say the tradie gets each surcharge "less our 15% fee".
  Saying the split to owners is optional; take it out if you would rather not.
- The legal pages' "last updated" date moved to 18 November 2026 for the
  terms and the tradie agreement. Tradies who agreed before today have not
  re-agreed to the new section 6.

Built on 2026-11-18: all of the above.

---

## 2026-11-17 — Free to join. The money is the 15% on every job.

Owners who rang after the first ads all said the same thing: "$600 a year for
maintenance isn't relevant to me." They were comparing the membership with what
they spend on repairs, not valuing the guarantee, because nobody values a
guarantee from a company that has never turned up for them. The friction is the
card step before the first job, not the number on it. $1 a month has the same
friction as $99.

**The model from today:**

- **Owners pay nothing to join.** No membership, no deposit. They add a property,
  put a card on file, and pay the fixed menu price when a job is done. The 15%
  platform fee is inside every menu price, as it always was.
- **Managers pay nothing to join either.** The Portfolio retainer stays built and
  is not pushed: it is still a choice on the add-property and Billing screens
  for a manager who wants one bill, and one tick on More > Markets hides it.
  A manager is asked to start with 10 properties for 60 days so the tradies
  can handle the volume: that is capacity, not price.
- **The response promise stays: on site within 24 hours, or 4 when urgent.** The
  "that month's membership is free" credit has nothing to credit. Replaced by:
  miss the time and the owner is not charged the call-out portion of that job
  (the market's diagnosis fee, NZ$225 in Queenstown, capped at the job's price).
  The tradie is still paid in full; the platform wears it.
- **Every tradie must have public liability insurance on file**, with the policy
  number and expiry. No insurance, or expired insurance, and the app offers them
  nothing, the same rule as licences.
- **Founding deposits already paid** are refunded in full. There is no first
  bill to take them off.
- **Jobs, quotes, surcharges, payouts and disputes do not change.**

**Why free beats cheap.** Any card step before the first job loses a third of
signups. $0 gets the property into the app, the QR card into the house and the
cleaner onto the link, and the first job makes the sale. A free app is also how
cleaners and managers put whole portfolios in.

**What this does to the money.** A property brings 2 to 4 jobs a year at about
NZ$235, so NZ$70 to NZ$140 a year in platform fee. Queenstown alone tops out
near NZ$200k a year. The business is national, and the levers are volume
discounts from tradies (open spec 3 below, lifting the take from NZ$35 to
about NZ$70 a job), Portfolio retainers when a manager wants guaranteed
capacity, and a low cost per property from owner lists rather than ads.

**Towns open on demand.** Owners anywhere in New Zealand can add a property.
A town opens for jobs only once it has tradies in every trade; until then an
owner there is told so when they try to log a job, and the admin is shown which
towns have properties waiting.

### Code to change

- Essential becomes a NZ$0 tier: the property is a member as soon as a card is
  on file, with no subscription and no monthly invoice. The code paths for a
  priced membership stay, for Portfolio and for a paid tier later.
- The missed-promise credit becomes the call-out credit above.
- Tradies: insurance policy number and expiry on their profile, required before
  approval and checked at offer time.
- Owner page, price list, thank-you page and ads: "free to join, fixed prices,
  pay when it's fixed". The founding deposit button goes. Refund paid deposits.
- Legal pages: a real privacy statement and tradie agreement written from
  `docs/LEGAL-TODO.md`, agreed to in the app with the time recorded. Owner
  terms likewise. Reviewed by Community Law before the first job, and by a
  lawyer at around 100 properties.

Built on 2026-11-17: everything above except the legal pages

### 2026-11-17 — Tradies: the insurance certificate is uploaded, the LBP number is optional, only the admin approves

The founder, in his words:

> "When a tradie signs up it has to have public liability insurance, and it has
> to be a document they upload, not just typed details. A Licensed Building
> Practitioner (LBP) number matters for some building jobs but is not needed for
> most, so it is optional. Tradies have their own accounts, but only I (the
> admin) can approve them; nobody is offered work until I approve."

**What changed:**

- **The certificate of currency is uploaded.** A PDF, JPG or PNG, up to 4 MB,
  beside the insurer, policy number and expiry date. It is a new kind of file
  (`insurance_certificate`) on the tradie, stored with the other photos and
  files, and opened through `/files/[id]`, which lets only staff and that tradie
  see it (not an owner they work for, not another tradie). The newest is the
  current one; older ones stay listed as a record. Code:
  `src/lib/tradies/certificate.ts`, `src/lib/files/uploads.ts`.
- **Where it is uploaded:** the tradie's profile (Insurance section), the admin
  tradie page (staff can open it to check it, and upload one a tradie emailed
  in), and the public sign-up form at /tradies. A certificate sent with the
  sign-up form is kept with the lead, seen only by staff, and moves to the
  tradie when the lead is made a tradie. Where file storage is not set up, the
  field still shows, with a note that it can be added later from the profile.
- **No certificate, no approval and no offers.** `insuranceProblem()` reports
  "certificate is not uploaded" when the three details are there but no
  certificate is, so the admin's Approve button refuses, and the offer query and
  the check at accept time skip anyone without one. The 30-day "insurance
  running out" warning still goes by the expiry date; its text now asks for the
  new certificate too.
- **The LBP number is optional.** A text field on the profile, the sign-up form
  and the admin page (with a link to the public LBP register search, as linked
  from www.lbp.govt.nz). Nothing waits on it. Saved on `tradies.lbp_number`
  and `leads.lbp_number` (migration `20261121000000_insurance_certificate.sql`).
- **Only the admin approves.** A tradie still waiting for approval can sign in
  to their own account, but every tradie page except their profile sends them
  back to it, under the banner "Waiting for approval: we'll text you". No
  offers, jobs or pay. Approval is a staff action only; a tradie's own switch
  is pause and back, and only once approved. A test proves a waiting tradie
  with perfect insurance and licences is never offered a job.
- **Audit entries:** certificate uploaded (on the tradie, or on the lead from
  the sign-up form), certificate moved from a lead, LBP number saved. Each is
  written in the same database step as the change.
- Legal page (tradie agreement, section 2), the tradie landing page, RUNBOOK
  ("A new tradie", "Insurance running out") and AGENTS.md now say the same.

**Decided while building, to confirm:**

- **Criminal history check is the Ministry of Justice record, not police vetting.**
  NZ Police vetting is only open to approved agencies (care of children or
  vulnerable people, schools, law enforcement), so HostFix cannot use it. The
  tradie agreement (section 2) now says the tradie requests their own criminal
  record from the Ministry of Justice (free, about a week) and sends it to us
  before their first job. Older entries below that say "police vetting" mean this.

- On the public sign-up form the certificate is asked for but **not
  required**, so no tradie is lost at the first step; it is required before
  approval. The insurer, policy number and expiry are typed in on the profile
  (or by staff from the certificate), not on the sign-up form.
- Tradies already approved with no certificate on file **stop getting offers**
  from this change until one is uploaded. The admin tradie page shows who.
- The dispatcher's "give this job to a tradie" button now checks the tradie can
  take it before writing anything, so a refused assignment leaves no record of
  an offer behind.

Built on 2026-11-17: all of the above.

---

## 2026-11-17 — A second tier for property managers (Portfolio)

The first inbound owner-side enquiry was not an owner. It was a property
manager with 63 properties. Managers are a real second segment, not a special
case: roughly a quarter of Queenstown's short-stay listings sit under
professional management, so this buyer will come back.

**They are not buying the same thing.** An owner with one holiday home is
buying a phone number to ring — peace of mind they do not currently have. A
manager already has tradies, systems and staff. What they lack is capacity:
the job their own people cannot get to, Friday at 4pm in peak season, with a
guest already in the house. Selling a manager 63 memberships is selling them
something they believe they already own, and it prices at $6,237 a month,
which ends the conversation.

### The structure

**The platform fee never varies: 15% of every job, every tier, every
portfolio size.** That is the spine. Only the access fee changes.

| Tier | Who | Access fee |
| --- | --- | --- |
| Essential | Owners, 1-9 properties | $99 per property per month |
| Portfolio | Managers, 10+ properties | A retainer banded by portfolio size |

Portfolio bands, per month:

| Properties | Retainer |
| --- | --- |
| 10-24 | $600 |
| 25-49 | $900 |
| 50-99 | $1,200 |
| 100+ | By arrangement |

A manager with 63 properties pays $1,200 a month plus 15% of jobs — around
$1,975 a month on an estimate of 25 overflow jobs.

**Why a band and not a per-property rate.** What a manager buys is guaranteed
response capacity, and capacity does not scale one-to-one with doors. It
scales with how many things break at once. A band says that honestly and
survives the obvious question on a sales call.

### The intro offer, in both tiers

The rule is the same — a small commitment to start — but the instrument
differs, because discounting a manager anchors them to the lower number and
makes month four a fight.

- **Essential: lower the price.** Half price for the first three months.
- **Portfolio: lower the scope.** A 60-day pilot on 10 properties at the
  10-24 band, then the real band. No discount is given, so there is no
  discount to claw back.

The pilot is also how the prices get tested. Every price in the menu is
researched rather than observed, and ten properties for 60 days produces real
job costs before the other 53 are priced.

### What is built (the app bills Portfolio itself)

- **A tier says how it is charged.** `billingBasis` on `MembershipTier`
  (`config/markets.ts`) is `per_property` (Essential) or `per_account`
  (Portfolio), and a per-account tier carries its bands. Both are columns on
  `membership_tiers` (migration `20261119000000_portfolio.sql`), editable on
  Admin > Markets > the market > Memberships, with plain-language labels. The
  bands are checked there: lowest first, no gaps or overlaps, only the top band
  open-ended or "by arrangement". Queenstown has Portfolio with the bands above.
- **The membership belongs to the account.** A new `portfolios` table holds the
  one retainer: the subscription, the band it is billed at and how many
  properties that was worked out from. Each property under it points at it and
  keeps the portfolio's status, so jobs, guest reports and cover checks are
  unchanged. Essential is untouched: still one subscription per property.
- **The owner picks Portfolio once**, on the Billing page or as the membership
  for a new property. Properties not yet paying for themselves join it, and so
  does every property added after. There is no per-property card page. The
  retainer cannot start below 10 properties ("Portfolio is for 10 or more
  properties"). The Billing page shows the one retainer, the band, the number
  of properties and the next payment date.
- **The band follows the property count.** Adding or taking a property off
  re-checks it (`bandFor` in `src/lib/markets/bands.ts`, `rebandPortfolio` in
  `src/lib/properties/portfolio.ts`). A change goes to Stripe for the next
  monthly payment, never a part-month charge, and is written to the audit log.
- **Jobs are the same.** Menu price, surcharges, the 15% fee, the owner's card
  charged and the tradie paid, exactly as for Essential.
- **The numbers count each retainer once.** Monthly membership income is
  per-property members times their price, plus each Portfolio retainer once.
- **Content:** `{{portfolio_from}}` (the lowest band) and a second "What it
  costs" card for managers on the owner page.

### What is still done by a person

- **100 or more properties is priced by arrangement.** The app never sets that
  price. Starting a Portfolio of 100+ is refused with a message, and the queue
  gets a "Portfolio price needs a person" item. An account that grows to 100
  keeps paying the 50-99 band until the admin sets the agreed retainer on the
  owner's page under Owners (it then takes effect from the next payment).
- **Fewer than 10 properties.** An account that drops below 10 stays on the
  lowest band and goes to the queue. Nobody is moved to Essential
  automatically.
- **The 60-day pilot.** A Portfolio with exactly 10 properties is billed at the
  10-24 band, which is the pilot. The 60 days themselves are not tracked by the
  app: note the start date and the review date below, and talk to the manager
  before day 60.
- **Missed promises on a Portfolio property** are not credited automatically
  (see "Owner decisions still outstanding").

Portfolio pilots under way (manager, start date, review date):

<!-- Add each pilot here: name, the date the retainer started, the date 60 days on. -->

### Settled in the build, to confirm with the founder

These were not covered by the decision. Each was the simplest reading, and
each can be changed:

- Taking a property off a Portfolio stops its cover at once (there is no
  part-month refund, as the retainer is for the account). The band drops from
  the next payment.
- An owner already paying Essential for a property keeps that subscription
  when they pick Portfolio. Only properties not yet paying join. To move one
  across, cancel its Essential membership; once the month it paid for has run
  out, add it to the Portfolio from its page.
- The founding deposit is never taken off a Portfolio retainer (Portfolio has
  no discount).
- Referral rewards are not paid for properties on a Portfolio (the reward
  counts a property's own monthly payments, and a Portfolio property has none).
- A market that offers no Portfolio shows an `[EDIT]` marker where
  `{{portfolio_from}}` would be, so the gap is counted on the admin screen.
- The first draft of this entry listed a `tier: "essential" | "priority"`
  union in `src/lib/content.ts` to fix. It no longer exists, so nothing needed
  changing there.

---

## 2026-11-16 — The demand test is built; real prices loaded; Priority removed

Done in the code (branch `claude/hopeful-hamilton-yd41nf`):

- **The researched menu is live.** `seed/menu-queenstown.json` is the 59 researched jobs and the
  `.proposed` file is gone. The 27 money tests were re-derived by hand from the new prices, not pasted
  from output (`tests/unit/money-flow.test.ts` header shows the working). Surcharges, off-menu fee,
  payout and approval limit are the new numbers, in the seed and in the `config/markets.ts` defaults.
- **The five `needsLocalQuote` jobs and the two add-ons start switched off** (`startsOnTheMenu` in
  `src/lib/db/seed-core.ts`), so 52 jobs can be booked and are on the price list. Switch one on from
  More > Markets once a local has confirmed its price.
- **25 jobs are owner-only** (`guestVisible: false`): upkeep, compliance checks, outdoor and seasonal
  work that a guest has no reason to report.
- **Priority is gone.** One membership, Essential, NZ$99. The code can still hold a membership that
  includes urgent call-outs (tested), but none is offered.
- **After-hours is before 7am, from 4:30pm, and all of Saturday and Sunday** (the row above: "after
  4:30pm and Saturdays"). Working hours can now be set to the half hour (migration
  `20261118000100_half_hour_working_day.sql`). Queenstown: 7am to 4:30pm, Monday to Friday. The old
  default was 7am to 6pm, Monday to Saturday. Public holidays are still treated as normal days: open spec 1.
- **The owner page is the demand-test page**: real prices, a NZ$99 refundable founding deposit as the
  first button and "Not yet: just send me the price list" as the second, 25 founding spots that stop
  taking cards when gone, the full price list on the thank-you page and by email (with a link back to the
  founding spot), and a 14-day scorecard on the leads page. `docs/DEMAND-TEST.md` is how to run it.
- **The pass mark is three owners with a card down** (`TARGETS` in `src/lib/leads/demand-test.ts`).
  Ten owner leads and two handymen, a plumber and an electrician are shown alongside it as signs, not
  as the pass mark.

Choices made while building it, for you to overrule:

- **Nothing on the page that is not built or not sourced.** Left out from the earlier drafts: "one
  number" to ring, calendar and guest-message links, one-off door codes, an app, the "three in four
  problems" statistic, what a Queenstown property earns, and any price comparison with the AA. "Who
  this is not for" says an owner who only wants emergency cover at their own home is better off with a
  home emergency plan, without naming a price.
- **The founding promises are the admin's own words** (More > Markets), shown word for word on the page,
  the card page and the email, so they can never drift apart.
- **Price list emails need your own domain in Resend.** With Resend's test sender the email is skipped
  and the leads page says so. The owner still sees the list on the thank-you page.

### Owed before Queenstown goes live

- **Founding billing.** The page promises founding members half price for three months (NZ$49.50 a
  month, then NZ$99) and that the NZ$99 deposit comes off their first bills. Billing today takes the
  deposit off the first month, up to one month's price, and charges full price after. Build a
  three-month 50% discount on the Stripe subscription for owners with a founding deposit, and carry any
  deposit left over into the next bills, or change the promise before anyone else pays. The go-live
  checklist shows this line until then (`foundingBillingLine` in `src/lib/leads/founding.ts`).
- **The weekly payout cycle** in "Facts that must not drift" below (everything closed Monday to Sunday
  lands the following Tuesday) is not built. The code pays each job after a 24-hour hold, and the
  tradie page says "about 5 to 6 working days after the job", which is what the code does.

---

## 2026-11-16 — Real prices researched (now loaded: see above)

*Done: the swap is made and the tests re-derived (entry above). Kept for the
reasoning.* `seed/menu-queenstown.proposed.json` held 59 researched jobs meant to
replace the placeholder menu.

Where the prices came from: Queenstown call-out plus first-hour rates as
advertised in November 2026. A local plumber or electrician charges a $90-130
call-out and $90-150 for the first hour, excluding GST. That is $207-322
including GST for an hour on site. The menu's typical $235 job sits in the lower
middle of that band.

That matters for the sales story. An earlier draft claimed the menu was priced
about 18% above market. It is not. That 18% was against the *national* average.
Against Queenstown the menu is at market. Nothing on a page or in an email
should say owners pay a premium for price certainty, because they don't.

Five items are priced off national averages rather than Queenstown quotes and
carry `needsLocalQuote: true`: `GD-01`, `PV-01`, `PV-02`, `PV-04`, `OD-03`.
Ring a local and confirm each one before an owner can book it.

### What the proposed file changes

| What | Live now | Proposed | Why |
| --- | --- | --- | --- |
| Jobs on the menu | 25 | 59 | The 25 missed most of what actually goes wrong in a short-stay house: winter work, compliance checks, outdoor and preventative jobs. |
| `urgentDollars` | 80 | 90 | A tradie dropping a booked job for a same-day call-out needs more than $80 to make it worth doing. |
| `afterHoursDollars` | 120 | 140 | Same reasoning, after 4:30pm and Saturdays. |
| `diagnosisFeeDollars` | 120 | 225 | $120 did not cover an hour on site at Queenstown rates. It was a loss on every off-menu job. |
| `diagnosisTradiePayoutDollars` | 102 | 190 | Holds the 15% fee on the new number. |
| `ownerApprovalAboveDollars` | 400 | 600 | At $400 the owner was being woken for ordinary jobs. $600 sits above almost every line on the menu, so an approval request means something unusual has been found. |
| `placeholderPrices` | `true` | `false` | |

The platform fee is unchanged: 15% of the owner price. Every owner price in the
proposed file is `payout / 0.85` rounded to the nearest $5, and the file's own
checks confirm no mismatches, no duplicate codes, and payout always below owner
price.

### The swap is a job, not a file copy — read this before doing it

`tests/global-setup.ts` seeds the test database from the live menu through
`seedMarkets`, so the money tests are built on the real prices. Overwriting the
menu turns 27 tests red in three files:

- `tests/unit/money-flow.test.ts` — 22 tests
- `tests/unit/cascade.test.ts` — 4 tests
- `tests/unit/demo-sample.test.ts` — 1 test

They fail for honest reasons. `HM-01`, which several fixtures log, goes from
$130 to $155. The $220 / $187 item the surcharge tests are built on
(`PL-01` today) is not $220 in the proposed menu. The surcharge and threshold
numbers are written into test *titles* as well as assertions — "the owner pays
NZ$80 more", "a quote over NZ$400 stops everything".

**Re-derive every number from the new prices. Do not paste in whatever the code
now returns.** These tests are the only independent check on the money path. A
test updated to match the output it is supposed to be checking is worse than no
test, and this is the one place in the app where that costs real money. The
arithmetic in them is written to be readable for exactly this reason
(`ownerTotalCents: 22000 + 8000 + 12000`) — keep that style, change the parts.

Also in the same commit:

- `tests/unit/config.test.ts` — the job-count range (20-30), the surcharge
  equality at line 99 and the $400 threshold at line 100 all pin the old values
- delete `seed/menu-queenstown.proposed.json` once it is the live file, so there
  is only ever one menu

`config/markets.ts` holds the same numbers as template defaults for a new
market. `seedMarkets` merges the seed file over the top, so Queenstown is
correct either way, but update the defaults too or the next market starts wrong.

---

## 2026-11-16 — The Priority tier is dead

There is one membership: Essential, $99 per property per month, 24-hour
response. Urgent response is an add-on the owner pays for, never an inclusion.

Priority was $149 for a 4-hour response, four urgent call-outs and four
quarterly checks. Delivering that costs about $68 a month against a $50
premium. It lost money on every customer who used what they paid for, and the
customers most likely to buy it are the ones most likely to use it.

*Done: removed from the config, the copy, the demo and the tests (entry above).*
**What had to change.** The tier was live in:

- `config/markets.ts` — the `priority` tier in `launchMarket.tiers`
- `src/lib/content.ts:26,66,69` — the `tier: "essential" | "priority"` union and the copy
- `src/lib/demo/sample.ts:68,199,210` — two demo properties on `tier: "priority"`
- `tests/unit/config.test.ts:23-41` — two tests require a Priority tier to exist and to cost more than Essential

Removing it means deleting the tier, narrowing the union, moving the demo
properties to `essential`, and replacing those two tests with ones that assert a
single tier.

A second tier may come back later. If it does it is priced off what it costs to
deliver, not off what looks good next to $99.

---

## Open specs — code changes the decisions need

These were decided but not built. Each one needs code, not a seed edit.

### 1. A third surcharge tier for Sundays and public holidays

$220, four-hour window, the whole surcharge to the tradie. Saturdays stay on
the after-hours rate.

No key exists for it. It needs:

- a field in the seed schema and in `src/lib/db/seed-core.ts` (see the
  `surcharges` block it reads around line 34 and merges around line 59)
- a column and a `Market` field alongside `afterHoursSurchargeCents` in
  `config/markets.ts`
- the window itself in whatever decides after-hours, so a Sunday is told apart
  from a Saturday
- a public holiday list per market. NZ holidays move. Southland and Otago
  anniversary days are regional and Queenstown observes Otago.

### 2. Urgent allowance per plan

`config/markets.ts:38-40` already has `urgentIncluded` and
`urgentIncludedPerMonth`, which is the right shape. Nothing sets them to
anything but off, which is correct for a single-tier Essential.

Keep the fields. If a tier ever includes urgent call-outs, the allowance is
four a *year*, not one a month. One a month costs about $30 a month to deliver
and would need a $50 premium to clear.

### 3. Two rates per job: routine and card

A tradie who books a job 24 hours ahead or more is paid the `routineRate`,
15-20% below the card rate. Same-day, urgent and after-hours work is always
paid the full `cardRate`.

The hard rule: **urgent work is never discounted.** A tradie on a discounted
urgent rate puts you last on a cold snap morning, which is exactly when the
response guarantee is being tested.

This is the lever that buys exclusivity. A $40 routine discount across 20 jobs
a month is $9,600 a year from one tradie. A $300 a month slot fee is $3,600.
The discount is worth 2.7 times the fee and is easier to sell, because the
tradie pays nothing up front and carries no ad spend. Pick one. Never both.

**Not ready to build.** It only pays off above roughly 60 properties. At 25
properties the network generates about 37 jobs a month spread across five
trades, so no single tradie sees enough volume for a discount to be worth
giving. Build the schema when the volume is in sight, not before.

### 4. Tradie volume floor

A tradie who takes fewer than 15 jobs a month reverts to the card rate. Same
timing as item 3 — it is meaningless until the volume exists.

### 5. Pre-authorise on accept, capture on close

This answers "who carries the risk when the owner's card fails after the tradie
has done the work". Nobody should. Pre-authorise the owner's card at the moment
the tradie accepts the offer, and capture when the job closes. A card that
cannot be pre-authorised means the job never gets offered.

---

## Owner decisions still outstanding

Not mine to make and not the code's.

- **What a missed promise on a Portfolio property is worth.** Essential credits
  that month's membership for the property. A Portfolio property has no price
  of its own, and a twelfth of the retainer, a share per property or a flat
  amount are all possible. Until this is decided the app credits nothing
  automatically on a Portfolio property and puts "Missed window on a Portfolio
  property" in the queue for a person to decide and credit by hand.
- **GST: principal or agent.** Whether the platform charges owners $235 and
  pays a tradie $200 as a principal, or collects $235 on the tradie's behalf
  and keeps $35 as commission. It changes what goes on every invoice and what
  gets returned to IRD. Joe's accountant decides. Until then
  `pricesIncludeGst: true` means the owner price is GST-inclusive and nothing
  more is claimed.
- **Legal documents.** Terms, the privacy statement, the tradie agreement and
  the insurance position stay placeholders until a lawyer writes them. See
  `docs/LEGAL-TODO.md`. The access-release design matters here: the platform
  hands out street addresses and door codes to houses that may have guests
  inside. Police vetting of tradies is not optional.

---

## Facts that must not drift

Things that have already been got wrong once.

- **Tradie payment timing.** Stripe holds New Zealand card money about four
  working days, and a payout takes another one or two. Money lands five to
  eight days out. Never promise 48 hours. The cycle is weekly: everything
  closed Monday to Sunday lands the following Tuesday. Predictable beats fast
  when the alternative is a 30-day invoice.
  `payoutArrival` in `config/markets.ts` is the single source of truth, and a
  test fails if "48 hours" reappears on the tradie page.
- **The competitor is scope, not price.** AA Home Response Plus is $209 a year
  against $1,188 for Essential. The answer is never that AA is worse value. It
  is that AA covers an emergency at your own home during business hours and
  does not send a tradie to a house with a guest in it on a Sunday. If an
  owner only wants emergency cover, AA is the better buy and the page says so.
- **SMS.** New Zealand has no alphanumeric sender IDs. A short code takes five
  to six weeks to provision with any provider, URL whitelisting is mandatory,
  and Twilio requires "Reply to this SMS will be charged" in every message.
  None of that blocks the first 20-30 jobs a month, which can run on a personal
  phone and web push.
- **Nothing is proven yet.** There are no paying owners. Every number in this
  file is a cost or a rate, not a demand signal. The demand test comes first.
