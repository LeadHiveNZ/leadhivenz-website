# Short-stay rental ops and maintenance software: competitor scan (15 Nov 2026)

**Headline.** I found no product, in New Zealand, Australia or elsewhere, that runs the whole loop (guest scan, fixed-price menu, timed offer cascade, automatic payout). The nearest pieces are Breezeway's pilot Service Network, Turno's cleaner marketplace and TIDY's timed priority list.

**Reading guide.** Unmarked facts come from pages I opened. "(snippet)" means I saw it only in a search summary. "Inference" is my conclusion. Would not load: Capterra, G2, GetApp, Software Advice (403, so their review quotes are snippets), Reddit (blocked to my tools), Turno's pricing page, ResortCleaning's site, EZcare's pricing page, Hostaway's help centre, the Host & Guest Fix+ site. My search allowance ran out before a last sweep for US handyman networks for hosts. Prices show "$": Turno states USD, the rest are USD by inference. Vendor pages were read 15 Nov 2026 and are undated unless noted.

## A. Comparison table

| Product | Reports by | Dispatch | Vendors? | Price | Payments | Standout |
|---|---|---|---|---|---|---|
| Breezeway | Guest via Guide web link, "creating an unassigned task" (no QR or photo mentioned); staff app; 24/7 Assist agents [1][2] | Manual, or offer pool where first to accept wins; no time limit documented [5] | Pilot: Service Network "in the greater Destin, FL area for cleaning services" [3] | First property free; $19.99/unit/mo under 5 units; 5+ by quote [1] | "Task payments" on Pro tier; network jobs auto-paid via Stripe when finished [4] | Guest report lands in the ops task list |
| Turno | Cleaner in app with photos; no guest route found [13] | Primaries first; backups after all reject or a set number of days before start; marketplace bids [9][17] | Yes: cleaner marketplace, cleaning only [10] | Free for one property or marketplace-only; else $10/property/mo or $96/yr (Oct 2026) [7] | Auto-pay on completion; host fee 3.9% card / 1.5% ACH (own cleaners), 8% / 5% (marketplace) [8] | Marketplace plus auto-pay |
| Properly | Cleaner "Problem Report": photo and severity slider (2021) [20] | "auto-dispatch to your preferred cleaner, or first-come-first-served"; unaccepted jobs resend to backups [19] | Yes: "verified" cleaners; coverage unstated [19] | From $12.99/property/mo, down to $5 at volume; $5 per remote inspection [18] | Not described | AI plus human check of completion photos |
| Operto Teams | Staff form: category, "Urgent" tick, photos [22] | Manager assigns; optional accept/decline "in the time frame given" [22] | No | $70/mo to 10 properties, then $7 each (third-party, Feb 2026) [24] | Piece-pay reports; no payout described [23] | Offline mode |
| Hostaway tasks | Staff only | Auto-tasks; assign to user or group (snippet) | No | Quote only | None found | Inside the PMS |
| Guesty tasks | Staff only | Auto-tasks; group tasks claimed in app (snippet) | No | Lite from $9/listing/mo; Pro by quote [27] | Expenses on work orders [28] | Inside the PMS |
| EZcare | Staff mobile app [29] | Drag-and-drop scheduling [29] | No (inference) | Unpublished | Invoices to PMS [29] | Inventory scanning |
| ResortCleaning | Guest QR "check-outs, service requests, or issue reports" (snippet) | Auto-schedule; assign to team [30] | Directory of local firms (snippet) | $5/property/mo ($20 minimum) or $1.39/appointment (Feb 2026) [30] | Invoicing only [30] | Cheap; guest QR |
| TIDY (US) | Owner or AI; no guest route found | Timed priority list, then everyone, then auto-search for new pros [34][36] | Via own network plus Google, Yelp, Thumbtack [36] | 3.9% of bookings ($19/unit minimum) plus $39/unit/mo maintenance add-on [35] | In-app: ACH 1.7%, card 3.9% [35] | Closest dispatch logic |
| Fix+, Touch Stay, Coast | Guest QR or link, no app; photos optional [31][32][33] | Ticket or alert to host/team | No | Fix+ 14-day trial; price unconfirmed | None | Self-help before escalation |

## Notes by product (mobile experience, reviews, caveats)

- **Breezeway.** Native app with checklists, photos and offline use [6]. iOS rating 3.2/5 (85 ratings): "constant input lag and delays" (2022); "You have to do all the company tasks on the desktop" (Mar 2025) [6]. Capterra 4.6 (about 196 reviews): praise for photo checklists; complaint that "the learning curve to take advantage of all the features is significant" (snippets). Network providers "always receive tasks as offers" and need a flat piece rate first [4].
- **Turno.** Native apps with photo checklists; iOS 4.4/5 for hosts, 3.8/5 for cleaners [14][13]. Card is authorised up to a day ahead (snippet); payout takes 2–5 business days by card, 5–7 by ACH [11]. Cleaners also pay 5% on marketplace jobs (snippet). Trustpilot 4.9 (2,292 reviews): "Turno is brilliant for managing my cleaners" [12]. Complaints: "Hosts can go in and get refunds even if you have proof the job was done correctly" (cleaner, Apr 2024) [13]; "they have no authority to guarantee a clean" (forum, Jun 2023) [15]. The guarantee is best-effort replacement; in the US Turno pays any price difference [10]. Maintenance is only flagged as "what's next beyond cleaning" (Jan 2026) [16]. An Australian marketplace exists (snippet); I found none for NZ.
- **Properly.** Free provider app; checklists in 8 languages; photo proof on every task [21]. Reviews are mostly from 2018 (snippet). One review site says Breezeway acquired it; Properly's own 2026 site shows an independent company, so I treat that as wrong.
- **Operto Teams.** Web dashboard; first five tasks download for offline use [22]; staff can be asked for "photos and/or videos" [25]. Capterra 4.9 (about 100), praise for training and support (snippet).
- **Hostaway and Guesty.** Hostaway's own blog: "Cleaning features are more basic than specialized tools" (Dec 2025) [26]. Guesty tasks sit in its main app with checklists, reference photos and staff uploads [28].
- **EZcare and ResortCleaning.** Almost no independent reviews (snippets).

## B. Patterns worth copying

- **No price, no dispatch (Breezeway network).** Outside providers get work only as an offer carrying a flat rate, and are paid automatically on completion [4].
- **Hold funds early (Turno).** Authorise the card before the job and capture on completion (snippet); this heads off failed-card disputes.
- **Tiered cascade (Turno, Properly, TIDY).** Primary then backup tiers, "first come, first serve" within a tier [9]; adjustable cut-offs and simultaneous "clusters" [34].
- **Text link, no app (hostcare, Tapi).** A text with address, access code and payout, one tap to confirm; tradies need no sign-up (snippets).
- **Triage before call-out (Fix+, Properly, Operto).** Host-approved self-help first [31]; then photo plus severity or "Urgent" flag [20][22].
- **Scoped flat rates (Lula, long-term rentals).** "A price set before the work is scheduled"; extras are quoted in writing before approval [40].
- **Public speed claim (Builderscrack).** "Most people find a tradie for their job within 6 minutes!" [41].

## C. Gaps and complaints a new entrant could exploit

- **Nobody escalates on a clock.** Turno backups wait for rejections or a days-ahead trigger [9]; Hospitable leaves a silent assignee in place [37]; Operto and Breezeway state no limit [22][5]. Inference: all are built for scheduled turnovers, not urgent repairs.
- **Guest reports stop at an inbox.** Breezeway: "an unassigned task" [2]; Touch Stay: assigning "is not currently available" [32]; Fix+: a ticket for the host [31].
- **Marketplaces are cleaning-only and absent from NZ.** Turno's search is cleaning-only (snippet); Breezeway's network is one Florida market [3]; TIDY covers "all 50 U.S. states" [36].
- **No fixed-price repairs.** Turno uses bids, TIDY and Builderscrack use quotes [17][36][41].
- **No hard guarantee.** See the Turno forum quote [15]; Builderscrack lists none [41].
- **Costly, slow payments.** Turno's marketplace takes 8% (card) from hosts plus 5% from cleaners, with multi-day payouts [8][11]; Operto and ResortCleaning don't pay out [23][30].
- **Heavy apps, hidden prices.** Breezeway iOS 3.2/5 [6]; Breezeway 5+, Hostaway, Guesty Pro and EZcare are quote-only [1][27].

## D. Direct competition

- **NZ and Australia: nothing found that matches the model.** Nearest substitutes:
  - Full-service managers that bundle trades: Homello, Auckland (18% + GST of revenue, repairs billed at cost) [43]; Bachcare (commission from 15%, snippet); Hometime, Australia (trade network and "negotiated rates", management clients only) [42].
  - General trade marketplaces: Builderscrack NZ (free to post, quotes, pay the tradie directly) [41]; hipages and Airtasker (quotes and bids, snippet).
  - Tapi (NZ): 24/7 AI maintenance concierge for long-term rental managers; no trade network stated [44].
- **Closest global threats:** Breezeway Service Network (offers, flat rate and autopay already built; one market, cleaning only) [3][4]; Turno (marketplace and auto-pay, maintenance signalled) [16]; TIDY (cascade and pro search, US only) [34]; Keepers (US, $19/property/mo; marketplace lists "plumbers, electricians, HVAC"; dispatch rules unpublished) [38][39]; Lula (flat-rate trade network, long-term rentals) [40].
- **Inference:** the gap is the combination. Breezeway or Turno could close it by adding trades and entering NZ or Australia.

## Sources

1. https://www.breezeway.io/breezeway-pricing
2. https://www.breezeway.io/guide
3. http://help.breezeway.io/en/articles/17711824-service-network-overview
4. http://help.breezeway.io/en/articles/17718849-assigning-and-paying-for-network-work
5. http://help.breezeway.io/en/articles/8948756-claim-tasks-for-administrators
6. https://apps.apple.com/us/app/breezeway-property-care/id1266431363
7. https://intercom.help/turnoapp/en/articles/2142069-what-are-the-fees-for-using-turno-as-a-host (8 Oct 2026)
8. https://intercom.help/turnoapp/en/articles/2693634-sending-payments-faq-hosts (24 Jun 2026)
9. https://intercom.help/turnoapp/en/articles/5538659-primary-and-backup-cleaners (23 Jul 2026)
10. https://intercom.help/turnoapp/en/articles/2643618-how-can-i-trust-a-marketplace-cleaner (14 Oct 2026)
11. https://intercom.help/turnoapp/en/articles/9669720-how-long-until-i-get-paid (13 Nov 2025)
12. https://www.trustpilot.com/review/turno.com
13. https://apps.apple.com/us/app/turno-for-cleaners/id1263301809
14. https://apps.apple.com/us/app/turno-hosts/id1391902056
15. https://ownerrez.com/forums/chat/turno-benefits-but-at-a-risk (Jun 2023, older)
16. https://www.buzzsprout.com/2327631/episodes/18425037-find-your-handyman-with-turno (2 Jan 2026)
17. https://www.bnbcalc.com/reviews/turno-review (updated 28 Aug 2026)
18. https://getproperly.com/pricing
19. https://getproperly.com/features/marketplace
20. https://help.getproperly.com/en/articles/5470736-report-problems-or-damages-to-client (Aug 2021, older)
21. https://getproperly.com
22. https://help-teams.operto.com/article/256-staff-dashboard-guide-with-accept-decline
23. https://help-teams.operto.com/article/147-piece-pay
24. https://strspecialist.com/reviews/operto-teams-operations-review (18 Feb 2026)
25. https://operto.com/teams/
26. https://www.hostaway.com/blog/automate-cleaning-tasks/ (updated 18 Dec 2025)
27. https://www.guesty.com/pricing/
28. https://www.guesty.com/features/tasks-management/
29. https://ezcare.io
30. https://strspecialist.com/reviews/resortcleaning-housekeeping-review (18 Feb 2026)
31. https://shorttermrentalz.com/news/host-guest-fix/ (15 May 2026)
32. https://help.touchstay.com/en/articles/15378976-task-management (13 Oct 2026)
33. https://coastapp.com/customers/forever-destin-uses-coasts-qr-codes/ (9 Feb 2026)
34. https://www.tidy.com/docs/pm/my-pros
35. https://www.tidy.com/pricing
36. https://www.tidy.com/docs/pm/find-new-pros
37. https://help.hospitable.com/en/articles/13539691-task-notification-responses-from-your-teammates (29 Sep 2026)
38. https://usekeepers.com/pricing
39. https://usekeepers.com/
40. https://www.lula.life/flat-rate-maintenance-price
41. https://builderscrack.co.nz/how-it-works
42. https://www.hometime.io/airbnb-property-maintenance
43. https://www.homello.co.nz/services-pricing
44. https://tapihq.com/en-nz/platform/maintain