# What similar products do, and what HostFix took from them

Written 15 November 2026. This is the plain-words summary. The four full reports, with every source and
the date each was read, are in `docs/research/`. Where a report could only see a search-result summary
and not the page itself, it says so there.

## The short version

1. **Nobody runs this whole loop.** Not in New Zealand, not in Australia, not found anywhere: a guest
   scans a code, a fixed-price job is offered to a tradie on a clock, and everyone is paid without a
   person touching it. Each piece exists somewhere. The combination does not.
2. **The closest products are American and aimed at long-term rentals or cleaning.** Lula (fixed-price
   trade network, no membership), Latchel (monthly fee, preferred-then-fallback dispatch), Turno (short-stay
   cleaning, primary-then-backup, automatic pay) and Breezeway (short-stay operations, with a paid trade
   network piloted in one Florida town).
3. **Two things in your brief were not found in any product studied:** an offer that moves to the next
   tradie after a set number of minutes, and an automatic credit when a response time is missed. Those
   are your two real differences. Lead with them.
4. **Your membership price is far above every comparable.** That is not a reason to drop it. It is a
   reason to be clear about what is being sold. See "The price" below.
5. **The risk is not a competitor. It is tradie supply in a small town**, and Breezeway or Turno adding
   trades and arriving here.

## Who is closest

| Product | What it is | How HostFix differs |
| --- | --- | --- |
| **Lula** (US) | A managed trade network with a catalogue of 450+ fixed-price jobs. Takes 12% from the tradie, nothing on catalogue handyman jobs. Pays in 5 business days. | No membership, no published response promise, sells to managers with 150+ doors |
| **Latchel** (US) | A monthly fee per unit. Tries the owner's own tradies first, then its network. Two spending limits. | The fallback network is not vetted. No fixed prices. |
| **Turno** (US, some Australia) | Short-stay cleaning. Primary cleaners first, then backups. Pays automatically on completion. About US$10 a property a month. | Cleaning only. Backups are tried after a refusal or days ahead, not on a clock. Not found in New Zealand. |
| **Breezeway** (US) | Operations software for short-stay managers. A guest link creates a task. Has a trade network with flat prices and automatic pay, in one Florida market, for cleaning. | The guest's report lands in an inbox for a person to deal with |
| **TIDY** (US) | Tries a priority list of pros on a timer, then everyone, then searches for new ones | Quotes, not fixed prices. US only. |
| **AA Home Response** (NZ) | NZ$34 to NZ$54 a year, then a fixed price for the first hour. "Usually arrive within an hour." | Emergencies only, no guarantee, and **Queenstown is not one of its regions** |
| **Builderscrack, hipages, Airtasker** | Post a job, tradies quote or bid, you pay the tradie yourself | Quotes and waiting, the opposite of what an owner three hours away needs |
| **Queenstown property managers** | Bundle maintenance into their commission (17% is the typical published starting rate) and bill call-outs on top | They are your competitor for owners who want everything done, and your best sales channel for the rest |

## What was copied

Each of these changed something that was built.

| Idea | Seen at | What it became in HostFix |
| --- | --- | --- |
| **A price before the job, and that price is the bill** | Lula ("the quote is the invoice") | Every menu job shows the owner's price before they send a tradie, and that is what the card is charged. No call-out fee on top. |
| **Try a fix before sending anyone** | Latchel (says 23% of requests are solved at intake), Fix+ | Each menu job can carry a "worth trying first" line shown to whoever is reporting it, for example: check the switch on the wall. |
| **Preferred tradie first, then a defined fallback** | Latchel, Turno, TIDY | First choice, then backup, then everyone else at once. Yours runs on minutes, theirs on refusals or days. |
| **Two spending limits, so small jobs finish on the first visit** | Latchel (soft and hard budget) | Small parts are inside the menu price. Parts above a set amount, and quotes above NZ$400, need the owner's yes. Each owner can set their own limit per property. |
| **No price, no dispatch** | Breezeway's network | A tradie is never sent an offer without the amount they will be paid in the text. |
| **A text with a link, no app to install** | Tapi, hostcare | The tradie accepts from the text and that same link is their job page. No sign-in. |
| **Show the suburb, not the address, until they accept** | Lula's accept screen | The address and the lockbox code appear only after a tradie accepts. |
| **A no-show cuts both ways** | Lula (pays the pro if nobody is home) | "I could not get in": the tradie is paid the call-out and the owner is charged it, with a photo as proof. |
| **Coming back to fix it is the tradie's job** | Lula, Latchel | The owner has a day to say something is wrong. That holds the tradie's payment until it is settled, and a refund reduces the tradie's payment in proportion. |
| **One list, kept empty, each item saying why it needs you** | Latchel's to-do queue, ServiceM8 | The dispatcher's Queue: most pressing first, one line on what to do, one button. |
| **Three numbers at the top of the page, the price in view, the form repeated at the foot** | The best of the 17 landing pages studied | Both public pages follow that order, with the guarantee as its own block. |
| **"Real jobs. Fast pay. No bidding."** | Lula's page for tradies | The tradie page leads with the same three ideas: fixed pay shown first, no quoting, no chasing. |

## What was deliberately avoided

| Their mistake | Evidence | What HostFix does instead |
| --- | --- | --- |
| **Charging tradies for leads that go nowhere** | hipages keeps only 58% of that income year on year. Thumbtack scores 2.0 out of 5. "Unqualified leads that we are forced to pay for." | Tradies pay nothing to join. They are paid for jobs, not charged for chances. Slot fees stay switched off (`docs/PLAN.md`, section 9). |
| **Fees that only appear at the end** | "They charged me $15 connection fee for $60 job" (Airtasker). Handy settled with the US regulator for US$2.95 million over hidden deductions. | One price for the owner, one amount for the tradie, both shown before anything happens. |
| **Guest reports that stop at an inbox** | Breezeway, Touch Stay and Fix+ all create a ticket for a person | A guest's report becomes a real job the moment the owner taps yes, or straight away if the owner chooses. |
| **Coordination without accountable tradies** | Latchel's fallback network "isn't a vetted or licensed network" | Plumbing, gas and electrical work is only ever offered to a tradie with a licence number and a date on file that has not passed. The software enforces it. |
| **A guarantee that is only a promise** | Turno: "they have no authority to guarantee a clean" | Miss the time and that month's membership is credited by the system, with no form to fill in. |
| **Slow pay** | "Long time before get paid" (Airtasker) | Paid automatically, with the date shown on the job. See the honest limit on this below. |
| **A heavy app** | Breezeway's phone app scores 3.2 out of 5: "constant input lag" | A website that works like an app, installs to the home screen, and needs no download to accept a job. |
| **A house in the logo** | 7 of the 17 products studied use a house or a roof | A door, slightly open. Plum and lime, because five of them lead with blue and six with green. |

## The price

This is the part to think hardest about.

| What people pay for something similar | A year |
| --- | --- |
| AA Home Response, emergencies only (NZ) | NZ$34 to NZ$54 |
| Turno, cleaning software | about US$96 to US$120 a property |
| Humming Homes, a home manager (US) | US$199 to US$599 |
| Property Meld, maintenance software | US$24 a unit |
| **HostFix Essential** | **NZ$1,188 a property** |
| **HostFix Priority** | **NZ$1,788 a property** |
| Honey Homes, a handyman on staff, labour included (US) | US$2,000 to US$5,500 |

HostFix charges five to ten times what software costs, and then charges for each job as well. The only
product in the same range includes the labour.

**What that means.** You cannot sell this as an app, and you should not try. An owner in Auckland or
Sydney is not buying software. They are buying three things nobody else in Queenstown will put in writing:
someone on site inside 24 hours or the month is free, a price they know before they say yes, and never
having to find a tradie from another city. Sell it against the cost of one bad review or one cancelled
booking, not against other software. NZ$99 a month is small beside one lost night or one refund to an
unhappy guest. Put your own nightly rate next to it when you pitch.

**What to watch.** If owners will not pay it, the fix is not a discount. It is a lower tier that charges
less each month and more per job, so the people who rarely need you pay for what they use. Every price
is on the admin screens, so this is a ten-minute change, not a rebuild. The waiting-list page and the
founding deposit exist to find this out before tradies are recruited.

## The market

- **Queenstown Lakes has about 5,400 registered short-stay properties**, roughly 4,000 on the Queenstown
  side and 1,300 in Wānaka (council figures, July 2025). Airbnb's own listings count is higher: 6,881.
- **They split into near-equal thirds:** hosts with one listing, hosts with 2 to 9, and operators with 10
  or more. Fifty companies run five or more.
- **The managers are both.** They already promise 24/7 cover and arrange trades, so an owner with a
  full-service manager does not need you. But a manager with 30 properties and no in-house tradie is
  one sale worth 30 memberships. The ones to call first are the small managers and the cleaners.
- **One per cent of Queenstown is 54 properties: about NZ$5,300 a month in memberships before a single
  job.** Three per cent is about NZ$16,000 a month.
- **Bigger markets, for later:** Sunshine Coast with Noosa (about 7,300 listings), Gold Coast (4,200 to
  7,100 depending on who is counting), Mornington Peninsula (4,400). Other New Zealand towns are under 2,200.
- **Some Australian councils make owners respond fast by law:** within 30 minutes in Noosa, within two
  hours on the Mornington Peninsula. That is a ready-made reason to buy.

## What tradies charge now, and what that means for the menu

Published New Zealand rates, mostly Auckland, since no Queenstown trade publishes prices:

- A plumber or electrician: NZ$90 to NZ$120 an hour plus GST. The first hour all-in is about NZ$160 to
  NZ$260 in working hours and NZ$240 to NZ$600 after hours.
- Small jobs: a blocked toilet NZ$150 to NZ$250, a tap NZ$150 to NZ$250, a power socket NZ$150 to NZ$250.
- A handyman: NZ$40 to NZ$90 an hour.

The placeholder menu was set inside those bands, and the after-hours surcharge of NZ$120 is at the low
end of what trades add. **Every menu price is still a placeholder.** Sit down with your first plumber and
your first handyman and set the real ones before anyone joins: Queenstown is likely at the top of each
band, plus travel.

## Rules that shaped the build

- **Licences (NZ).** Replacing a tap washer or clearing a blocked drain appears not to need a licence.
  Fixing or moving any pipe or fixture, all gas work, and any electrical work in a rented property do.
  The menu marks each job, and the software will not offer a marked job to a tradie without a current
  licence. *The reports read the regulators' guidance pages, not the Acts. Your lawyer confirms the line.*
- **Licences (Australia).** In Queensland and New South Wales the licence rules can apply to whoever
  contracts for or advertises the work. Whether HostFix is a marketplace or a contractor there needs
  legal advice before the first Australian job. It is on the lawyer's list.
- **Texts.** New Zealand and Australian law need the sender named in every business text and a way to
  stop them. New Zealand phone companies need the sender registered first, which takes 4 to 6 weeks.
- **Privacy.** From May 2026, New Zealand law requires telling people when their details came from
  someone else, such as an owner giving you their cleaner's number.

## What could go wrong

1. **Too few tradies.** Jim's, a large franchise, leaves over 200,000 leads a year unserved. In a town
   this size, the guarantee will be tested by how many plumbers will answer on a Sunday, not by software.
   The Tradies page shows, per trade, how many are ready today. Do not open until each trade on the menu
   shows at least two. The credit is capped at one per property a month so one bad weekend cannot cost
   a month's income across the board.
2. **Going around you.** Once an owner has a good plumber's number, why pay 15%? Other platforms answer
   with rules and penalties, which tradies hate. Your answer is what the tradie gets for staying: the
   card is already on file, there is no invoice, and the pay is automatic. Today the tradie can see the
   owner's number after accepting. Hiding it is possible later, at a cost per number.
3. **A big player arrives.** Breezeway already has offers, flat prices and automatic pay built, in one
   town. Turno has said maintenance is next. Neither is in New Zealand. Your lead is local tradies under
   agreement and a guarantee they would have to match.
4. **The price** (above).

## What could not be confirmed

- No Queenstown manager's commission and no Queenstown trade's hourly rate could be found in print.
- Several comparison sites and help centres blocked reading, so some review quotes come from search
  summaries. Each is marked in the full reports.
- The search for American handyman networks aimed at hosts was cut short. There may be a small one that
  was missed. Nothing was found in New Zealand or Australia.
