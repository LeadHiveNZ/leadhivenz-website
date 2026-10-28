# Price book — Mike's Plumbing & Gas

All prices NZD, **excluding GST** unless stated. GST is 15% and is always shown as its own line.
This file is the source of truth for pricing. In phase 2 it is loaded into the `price_book`
table, which Mike can edit from the office screens. Anything not in this file is priced
"CHECK" for Mike to fill in by hand.

## Labour (per hour)

Charged per person on site. The first hour is charged in full; after that, labour is billed in
15-minute blocks.

| Person | Standard | After hours | Night / Sunday |
| ------ | -------: | ----------: | -------------: |
| Mike (certifying gasfitter) | $115 | $165 | $195 |
| Jono (qualified plumber)    | $115 | $165 | $195 |
| Tama (apprentice)           | $75  | $110 | $130 |

Rate band is worked out from the time the job starts and the day of the week
(see `config/brand.ts` → `rateBands`):

- **Standard**: Monday to Friday, 7:00am to 5:00pm.
- **After hours**: Monday to Saturday outside standard hours, before 10:00pm.
- **Night / Sunday**: 10:00pm to 6:00am any day, all of Sunday, and public holidays.

## Call-out (per visit)

| Type | Price |
| ---- | ----: |
| Standard call-out | $95 |
| Emergency call-out (after hours / night / Sunday) | $195 |

## Travel (per visit, by zone)

| Zone | Covers | Price |
| ---- | ------ | ----: |
| Zone 1 | Christchurch city and inner suburbs | Included |
| Zone 2 | Outer suburbs (e.g. Rolleston, Kaiapoi, Lincoln, Prebbleton) | $45 |
| Zone 3 | Rangiora, Darfield, Leeston, Akaroa | $85 |
| Beyond | Anything further | CHECK |

## Sundries

| Job size | Price |
| -------- | ----: |
| Small job (consumables, tape, solder, fittings under $10) | $25 |
| Big job (full day or more) | $85 |

## Materials

Materials are charged at cost plus markup. **Assumption:** markup tiers below are a
placeholder until Mike confirms his real figures.

| Cost of item (excl GST) | Markup |
| ----------------------- | -----: |
| Up to $50   | 40% |
| $50 to $250 | 30% |
| Over $250   | 20% |

## Rules

- GST 15% shown separately: subtotal excl GST, GST, total incl GST.
- Never hard-code a price that is not in this book.
- If a line cannot be priced from this book, mark it **CHECK** for Mike.
- Invoices go to Xero as **DRAFT** only. Nothing is ever sent to a customer from the app.
