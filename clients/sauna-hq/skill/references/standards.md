# Sauna HQ build standards and take-off rules

All dimensions in millimetres. These come from Marko's shop drawings, his costing spreadsheet
and his emails of 2 November 2026.

## Room
- Internal sizes of the framed room: length (long dimension), width, ceiling height.
- Standard ceiling 2100 (a false ceiling is built at this height). Never above 3000.
- Volume for heater sizing = L × W × H in m³, plus 1 m³ for every m² of glass (Marko's rule).

## Board stock lengths
- Lining boards and planks are bought in 1.5, 1.8, 2.1, 2.4, 2.7 and 3.0 m.
- Charged length = the next stock length at or above the needed length. 1320 wide ceiling
  boards are 1.5 m; 2100 walls are 2.1 m; 2200 walls are 2.4 m.
- Anything over 3.0 m is made up in 0.3 m steps.

## Lining (cladding)
- Boards run vertical on walls, finishing about 60 mm off the floor; ceiling boards span the
  width of the room.
- Cover widths once fitted: Cedar 85 × 12 covers 80; Alder 120 × 15 covers 107;
  Accoya 140 × 15 covers 124.
- Ceiling boards = ceil(length / cover) + 1 spare, at stockLen(width).
- Each wall = ceil((wall width − glass width − door width) / cover) + 2 (one ripped board at
  each end plus a spare), at stockLen(ceiling height). A fully glazed wall has no boards.
- Door opening width default 700.

## Benches
- Bottom bench 450 high × 460 deep. Top bench 900 high × 560 deep. Both run the full length of
  the long wall unless the drawing says otherwise. A return bench on the short wall is optional
  and is (width − 560) long.
- Planks: 90 × 35 (cedar), 120 × 28 (Alder), 140 × 20 (Accoya).
- Top planks per bench = round(depth / 110). Add 2 fascia planks (front and back).
  560 deep → 5 + 2 = 7. 460 deep → 4 + 2 = 6. 1050 wide custom bench → 10 + 2 = 12.
- Plank length = stockLen(bench length).
- Infill panels are optional. Two positions: between the top and bottom bench (recommended, so
  the floor under the bottom bench can be cleaned) and below the bottom bench. Some clients take
  both. Priced per lineal metre of bench: $125 cedar, $115 other timbers.
- Bracing cleats (underframe) = 1.8 lineal metres of plank stock per lineal metre of bench, at
  the plank rate. This reproduces Marko's spreadsheet to the dollar.
- Wall cleats: flat $80 per job.
- Supporting legs: any bench over 2100 long gets one leg; over 2700, one leg every 1000
  (a 3000 bench has 2). $250 per leg, flat.

## Trims, backrest, skirting
- Corner trims 17 × 17 in all 8 corners: 4 vertical at stockLen(height) + 2 × stockLen(length)
  + 2 × stockLen(width) around the ceiling.
- Backrest: 2½ rail, 265 high above the top bench. Priced per lineal metre of top bench (the
  wall length): $125 cedar, $115 other timbers.
- Skirting: 100 mm black aluminium, 3600 lengths, cut to each wall, never joined. Count
  ceil(wall / 3600) per non-glass wall.

## Shell items (flat allowances by job type)
| Item | Domestic | Commercial |
|---|---|---|
| Wall frame allowance | 150 | 200 |
| Ceiling frame | 280 | 600 |
| Foil and tape | 250 | 300 |
| Battens 42 × 19 | 300 | 450 |
| Fixings | 250 | 350 |

Wall and ceiling frame figures are Marko's. Foil, battens and fixings for commercial are
estimates until he confirms them.

- Insulation: $23 per m² of clad wall plus ceiling.
- Door: custom built with ½ lite window, timber push/pull handles, roller catch, $2,150 each.
- Glazing (glass front walls and windows): $600 per m².

## Heater sizing
- Volume ranges per model are in rates.md. Pick the smallest NM-family heater of at least 6 kW
  whose range covers the volume. Marko does not round the volume, but when it sits within about
  0.5 m³ of a heater's maximum he recommends the next range up, so treat the top of each range
  as max − 0.5. (A 0.5 m³ allowance under the minimum is kept so his NM 600 choice for the
  5.6 m³ Chandrajit room reproduces.) If no NM model covers it
  (large or glass-heavy rooms), pick the cheapest residential model that does (Smooth, Velvet,
  Saana). Commercial heater-only models are never chosen automatically for a home sauna. Offer
  every other priced heater that fits as an upgrade.
- Residential models include their controls. Commercial "E" and Ultra/Peak models are heater
  only and need a control panel added.
- From January 2026 all heaters ship with a Wifi controller; no Wifi upgrade line on quotes.

## Pricing
- Materials subtotal × 1.35 (35% markup), plus labour, then GST 10% on that sum.
- Heater, control panel, lighting, accessory pack ($300) and demolition are added after GST
  at retail (prices already include GST).
- Quote shows: Total Cost $X + GST = $Y Inc GST, where Y is the sum above and X = Y / 1.1.
