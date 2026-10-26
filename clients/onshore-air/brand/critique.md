# Onshore Air: self-critique log

Every change below came from looking at Playwright renders: review sheets, 2× zooms, 16 px pixel views and full-page and per-section screenshots of `presentation.html`. Seven rounds in total, listed in order. Round 7 is the overseer's review.

## Round 0: exploration (prototype sheets, before any lockup)
| Area | What the render showed | Change |
|---|---|---|
| Type specimen (15 faces) | Several rows broke mid-word, e.g. "ONSH" then garbage. opentype.js 2.0's `toPathData()` emits `NaN` coordinates and flips Y when given an options object. | Wrote our own path serialiser in `lib/type.js` that throws on any non-finite value. |
| Type choice | Montserrat is the category default (Crown Power, Static Electrics and Temper Troops all use it). | Chose Outfit ExtraBold (Evolution), Sora (Horizon) and Red Hat Display Black (Monogram). |
| Evolution | The first discs (E1–E4) read as a beach ball, with the orange cap as heavy as the navy one. | Settled on a 30° diagonal and per-band wave amplitude 5/9/5: calm outer waves, a stronger central split. This reads as a sphere, like the original. |
| Horizon | H1 was a generic sunset bowl. H2 (tapered line) was the swoosh cliché the research rules out. H8–H10 (figure-ground) read as Saturn. H15/H16 looked like weather icons. | Picked the "wrap": the horizon line rises around the sun as an air current. Then W1–W8: the split-sun version (W4) keeps the warm/cool equity, with flat terminals. |
| Monogram | The thin-ring version read as a button, and the cut-ring version lost the ring at small sizes. | Heavy ring (inner radius 62%) with a gentle single-crest wave: a porthole view. |

## Round 1: first full lockup review
| What the render showed | Change |
|---|---|
| Stacked marks looked small, at about 27% of wordmark width. | Mark height raised to 3.3× cap height (Evolution), 3.8× (Horizon) and 3.1× (Monogram). |
| The Horizon stacked mark sat visibly off-axis. bbox centring ignores that the sun carries about 80% of the visual mass. | Optical centring: shifted 80% of the way from bbox centre to sun centre. |
| The Horizon horizontal mark floated. | The line's bottom edge is now locked to the descriptor baseline, giving the mark and text a shared baseline. |
| The Monogram mono version merged into a navy disc with hairlines, and the sun/sea idea was lost. | Dedicated embroidery cut: solid ring plus solid sun segment, with the wave as its lower edge. |
| Mono gaps (5.5–7.5 units) come out under 1 mm at a 25 mm chest crest. | Every mono file now uses widened gaps (8–9 units). |
| At 120 px the horizontal's descriptor is unreadable (about 3 px). | Added `horizontal-compact.svg` (no descriptor) for small digital use. |

## Round 2: weight and spacing
| What the render showed | Change |
|---|---|
| Horizon's Sora SemiBold looked light next to the bold sun, and its descriptor needed 315/1000 em tracking to justify, which looked floaty. | Moved to Sora Bold, name tracking 180→150, descriptor 0.30→0.33 cap. Descriptor tracking fell to about 207. |
| The Evolution compact mark was undersized. | 1.85→2.1× cap height. |
| The SVGs had negative viewBox origins and zero-length `v0`/`h0` segments. | viewBox normalised to `0 0 W H`; zero segments stripped. |

## Round 3: 16 px pixel test (nearest-neighbour zoom of real renders)
| What the render showed | Change |
|---|---|
| Horizon's master icon at 16 px: the line collapsed to a faint 1 px grey stroke, leaving a sun with a smudge. | Added a favicon cut (`favicon.svg`) with a 26-unit line, shorter tail and 11-unit gaps. It now renders a solid 2 px stroke. |
| Evolution and Monogram survived, but their gaps went sub-pixel. | Favicon cuts with wider gaps for both. The 16/32 px PNGs use the favicon cut; 64 px and up use the master. |
| GBP and social avatars need a filled tile. | Added `icon-app.svg`: the concept's navy, full-bleed, mark at 70%. |

## Round 4: mockup review (section screenshots)
| Mockup | What the render showed | Change |
|---|---|---|
| Van | Services line ran under both wheel arches ("LATIONS … HYDRO CL"). Website collided with the gold stripe. ARC licence hidden under the skirt. | Fit-to-width services text between the arches, copy re-stacked above the stripe, door icon and licence moved up. |
| Van | Arches showed the light background (white "mudguards"). Cause: arc `large-arc` flag set to 1 drew the arch circle 28 px too high. | Corrected the flag to 0 and added dark wheel wells. |
| Van | Door-rail line ran through the phone number, and seams cut hard through the wordmark. | Rail removed, seams lightened. |
| Polo | Crest crowded the placket buttons. | Moved to the true left-chest position. |
| Phone | Headline "FOR THE SUNSHINE COAST" overflowed and was clipped. | Three lines plus a width guard in `textSVG`. Real status-bar icons and content skeletons replace the placeholder glyphs. |
| Business card | Back-of-card details were centred by flex `stretch`, and the 5–6 px lines were clipped by a tight viewBox. | Left-aligned, viewBox padding 2→6 units. |
| Browser tabs | In dark browser chrome the navy parts of every favicon vanished (Horizon's line entirely). | `favicon.svg` is now adaptive: an embedded `prefers-color-scheme: dark` rule turns navy white. The dark mock shows that state. |
| Palette strip | "Contrast on white 1.6:1" read as a defect. | Rewritten as usage guidance with on-navy and on-white ratios ("On navy 9.5:1 · accent only on white"). |
| On-navy demos | All concepts were shown on #0B1F5C even though each has its own navy. | Each concept is now shown on its own navy. App tiles use it too. |

## Round 5: type at 1500 px
| What the render showed | Change |
|---|---|
| R→E reads tight in Outfit and Red Hat (the R's leg kicks out). | Optical kerning +12 (Outfit) and +10 (Red Hat), in 1/1000 em. |
| Sora's wide tracking left the word space only about 1.5× the letter gaps, so ONSHORE AIR blurred into one word. | Word space +60/1000 em. |

## Round 6: system rules and portability
| Check | Result / change |
|---|---|
| Clear-space diagrams | The first version's mid-edge markers crowded the artwork, so markers moved to the corners. x = name cap height (100 units in every lockup file). |
| XML validity | All 54 SVGs parse. None use `<text>`, gradients, filters, strokes, clip paths, transforms or width/height. |
| Second renderer | CairoSVG (not Chromium) renders the lockups, mono files and adaptive favicons identically. |

## Round 7: overseer review
| Change | What the render showed | Result |
|---|---|---|
| Recommendation | The overseer overruled Monogram. Only Evolution keeps the diagonal sun-meets-sea split customers already know, and it has the most personality on a van and in a feed. Monogram is the safest but reads as generic. | Presentation, before/after caption (with a Recommended badge) and README now recommend Evolution. Monogram is the runner-up for maximum simplicity; Horizon is the premium outlier. |
| Horizon stroke | The round-1 line read as a fishing hook or letter J, and its squared top-right end looked unfinished. | Rebuilt from explicit edges as a filled shape. The inner edge is the flat horizon plus an exact concentric arc, so the gap to the sun is constant. The outer edge holds full weight under the sun, then tapers to a point after a 108° wrap. |
| Horizon, second version | A constant-width stroke with a round cap tangent to the arc (100° wrap) still read as a J. | Rejected. The taper was kept. See `screens/horizon-taper-vs-roundcap.png`. |
| Horizon favicon cut | Re-tested at 16 px. | 26-unit stroke, 100° wrap, fuller taper: the body holds as a 2 px stroke and the tip fades as intended. |
| Monogram counter | The flat horizontal wave lost the heritage diagonal. | Replaced with the original diagonal S-split: warm bottom-left, cool top-right, one gentle S-curve at 30°. |
| Monogram ring | The inner mark looked small at 32 px. | Ring thinned 38→33 units (-13%), so the inner mark radius grows 55→60 (+9%). |
| Flat vs diagonal at 16 px | Side-by-side at 128/32/16 px with zoomed pixels (`screens/monogram-flat-vs-diagonal.png`): both read as a navy ring with yellow and blue inside. Flat has a bigger yellow top; diagonal has a larger inner mark at 32 px. | A tie at 16 px, so the diagonal is kept, per the heritage preference. Mono cut: ring plus the solid warm region. Filling both regions read as a tennis ball. |
| Evolution stacked | The icon should lead the wordmark. | Mark +8% (3.3→3.56× cap height). Gap raised 0.62→0.66× cap after checking on white and navy, since the larger disc made the old gap feel tight. Nothing else on Evolution changed. |

## Known limits, honestly stated
- CMYK and Pantone values are not proofed. The printer must match them from the hex values on stock.
- Embroidery files (DST) must be digitised by the embroiderer from the mono SVGs.
- Mockups are stylised HTML/SVG illustrations, not photographic composites.
- No IP Australia trade-mark search has been run on the marks yet. Do one before final sign-off.
