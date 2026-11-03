---
name: sauna-hq-quoting
description: Quote and cost a custom-built sauna the Sauna HQ way, and maintain the Sauna HQ Quote Builder tool. Use this whenever Marko or anyone at Sauna HQ mentions a quote, a price, a costing, a take-off, board counts, bench planks, a client's room size, a Narvi heater choice, updating timber or heater prices, or changing how the quote builder works. Trigger even when they only give a room size like "2400 x 2000 x 2100, glass front, cedar and alder" or paste a plan, because that is a quote request. Also trigger for materials or order lists, alternative timber savings, and rewriting the client quote letter.
---

# Sauna HQ quoting

Sauna HQ (Marko Tossavainen, Dandenong South VIC) fits out the inside of a framed room as a
traditional Finnish sauna. Every job is quoted individually, but almost everything in the
take-off follows fixed rules. This skill holds those rules, the current rates, the wording of
the client quote, and the quote builder tool, so a quote that used to take 45 minutes of hand
calculation takes two.

There are two kinds of request. Work out which one you have before you start.

1. **Quote a job.** Marko gives a room size (and maybe a plan, glass walls, a door position,
   benches, a timber preference). Produce the costing, the materials list and the client quote.
2. **Change the tool or the rates.** Marko wants a price updated, a rule changed, a new timber
   or heater added, or the quote builder page altered. Edit the right file and hand it back.

## Quoting a job

Read `references/standards.md` (the build rules and take-off formulas) and
`references/rates.md` (current prices) before calculating. Then work through the job in this
order, the same order the costing spreadsheet uses:

1. **Room.** Length, width, ceiling in mm. Ceiling defaults to 2100 if not given. Note each
   wall's glass width and which wall has the door. Compute floor area and volume.
2. **Shell items.** Wall frames, ceiling frame, insulation, foil, battens, fixings from the
   domestic or commercial allowances.
3. **Lining boards.** Per timber: ceiling boards span the width and are bought at the next
   stock length above the width; count = ceil(length / cover) + 1 spare. Each wall:
   ceil((wall width - glass - door) / cover) + 2, bought at the next stock length above the
   ceiling height. Fully glazed walls get no boards.
4. **Benches.** Standard layout is a top bench (900 high, 560 deep) and a bottom bench
   (450 high, 460 deep) running the full long wall. Planks per bench = round(depth / 110) top
   planks + 2 fascia. Infill panels are optional (between benches is the usual recommendation,
   under the bottom bench on request) at $125/$115 per metre of bench. Bracing cleats = 1.8
   lineal metres of plank stock per metre of bench. Wall cleats flat. Supporting legs: one on
   any bench over 2.1 m, one every metre past 2.7 m, $250 each.
5. **Trims, backrest, skirting, door, glass.** Corner trims in all 8 corners (4 vertical at
   ceiling height, 4 around the ceiling perimeter). Backrest priced per metre of top bench
   ($125 cedar, $115 other). Skirting in whole 3.6 m lengths per wall, never joined. Door is a
   fixed price. Glazing $600 per square metre.
6. **Totals.** Materials subtotal, then 35% markup, then labour (Marko's judgement, ask if
   not given, do not invent it), then 10% GST on those three. Then add heater, control panel if
   needed, lighting, accessory pack and demolition at retail. That sum is the price inc GST;
   divide by 1.1 for the ex GST figure shown on the quote.
7. **Heater.** Volume is L × W × H plus 1 m³ per m² of glass. Pick the smallest heater in the
   NM family that is at least 6 kW and whose range covers it; when the volume sits within
   0.5 m³ of a heater's maximum, go to the next range up, as Marko does. List every other priced heater that fits as an upgrade with the
   price difference.
8. **Alternative timbers.** Run the whole take-off again for each other timber Marko wants
   quoted. Board counts differ because cover widths differ. Present the primary timber as the
   headline price and the others as a saving or an addition.

Check your work against `references/worked-example.md` (the Chandrajit job) whenever you
change a rule. If the formulas stop reproducing 85 wall boards, 27 ceiling boards, 13 bench
planks, a $101 trim line and about $25,540 inc GST on that room, something is wrong.

### What to hand back

Give three things, in this order, so Marko can use whichever he needs:

1. **Costing table** per timber: every material line with its take-off (counts × lengths ×
   rate), subtotal, markup, labour, GST, heater, lighting, extras, total inc GST.
2. **Materials list** per timber at the lengths they are bought in: boards, planks, slats,
   trims, skirting lengths, insulation m², door, heater model, lighting.
3. **Client quote** in the exact Sauna HQ format in `references/quote-format.md`. Use Marko's
   own phrasing for the scope bullets. Never show cost prices or markup in the client quote.

If something is missing (labour, which timbers to quote, door wall), make one reasonable
assumption, state it in one line, and carry on. Do not stop the quote to ask.

## Changing the tool or the rates

The quote builder is a single HTML file at `assets/quote-builder.html`. It does everything
above in the browser: room in, costing, materials list and client quote out, with a Rates and
standards tab where every number can be edited and saved in the browser.

- **Price or rule change.** Edit `DEFAULT_RATES` near the top of the `<script>` block (timbers,
  flat rates, heaters, controls, lights, standards) and update `references/rates.md` or
  `references/standards.md` to match, so the skill and the tool never disagree. Then give the
  edited HTML back as a downloadable file and, if the conversation supports artifacts, render
  it so Marko can try it immediately.
- **New timber.** Add a row to `timbers` with name, spec wording for the quote, cover width in
  mm, and rates per lineal metre for lining, planks, infill/backrest board and trims.
- **New heater.** Add to `heaters` with family, kW, min and max m³ and the retail price. A price
  of 0 keeps a model off quotes.
- **Job files.** The tool saves and opens jobs as `.json` files (project inputs plus a snapshot of
  the rates used) and exports the costing as CSV. If Marko pastes or uploads one of these job
  files, read `project` from it and quote from those inputs.
- **Behaviour change** (a new line item, different bench rules, a new quote section). Change
  the `cost()` function or `renderQuote()` and re-run the Chandrajit figures in your head or in
  the page before handing it back.

Keep the Sauna HQ branding (orange `#f4901c`, charcoal `#485050`, embedded logo) and keep the
page a single file with no external dependencies beyond Google Fonts, because Marko hosts it
as a static page.

## Things Marko has said that are not negotiable

- Every job is quoted individually. Lineal metre rates are inputs, not the answer.
- Boards are bought in 300 mm steps: 1.5, 1.8, 2.1, 2.4, 2.7, 3.0 m. A 2.2 m wall is charged
  at 2.4 m. Never pro-rata a board length.
- Add boards for the ripped start and finish board plus a spare. Being one board short on
  site costs more than the board.
- From January 2026 every heater ships with a Wifi controller, so the Wifi upgrade line stays
  off quotes unless he is clearing old stock.
- Labour is his call. Suggest nothing unless he asks for a starting point, then explain it
  as weeks on site times crew cost plus travel.
