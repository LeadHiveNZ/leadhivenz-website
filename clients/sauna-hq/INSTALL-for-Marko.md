# Sauna HQ quoting in your own Claude

Two pieces. Install both and you own the whole thing.

## 1. The skill (teaches Claude how you quote)

File: `sauna-hq-quoting.skill`

1. Open claude.ai, go to **Settings → Capabilities** (or **Skills**) and choose **Upload skill**.
   Pick `sauna-hq-quoting.skill`. If Joe sends you the file in a chat, there is a **Save skill**
   button on the file card instead.
2. Start a new chat and type a job the way you'd say it to a staff member:
   "Quote a 2400 x 2000 x 2100 sauna in Doncaster, glass front wall, door on the short wall,
   cedar and alder, labour 8,000." Claude will produce the costing, the order list and the
   client quote in your wording.
3. To change a price: "Cedar lining is now $18.40 a metre, update the skill." Claude edits the
   rates file and gives you the updated skill to re-upload. Or just tell it the new price in
   the chat for a one-off quote.

Inside the skill: `SKILL.md` (the method), `references/rates.md` (every price),
`references/standards.md` (bench heights, board rules, heater sizing),
`references/quote-format.md` (your quote letter), `references/worked-example.md`
(the Chandrajit job as a check), and `assets/quote-builder.html` (the tool).

## 2. The quote builder (the point-and-click tool)

File: `quote-builder.html`

- **Use it anywhere:** double-click the file and it opens in your browser. No internet needed
  except for the fonts. Bookmark it. It saves your rates in that browser.
- **Host it for the office:** Joe can put it on a web address behind a password. Same file.
- **Change it with Claude:** drag `quote-builder.html` into a Claude chat and say what you
  want, for example "add a steam room option" or "put the Accoya on every quote by default".
  Claude hands back the edited file. Download it and replace the old one.
- **Every price lives in the Rates and standards tab.** Change a number there and every quote
  from then on uses it. Use **Copy rates** to move your numbers to another computer and
  **Import pasted rates** on the other end.
- **Save job / Open job.** Once a job is filled in, click **Save job**. It downloads a small file
  named after the client (for example `SaunaHQ Smith 2026-11-03.json`). Keep it in the client's
  folder. When the client changes something, drag that file onto the page or click **Open job**,
  change what moved, and save again. If your prices have changed since, it tells you and offers
  to re-price at the old rates so the original quote still adds up.
- **Download costing (Excel).** Saves a spreadsheet of every line, both timbers, plus the
  materials list. Opens straight in Excel.
- **Load the Chandrajit job** button shows a real job so you can see your numbers come back.

## What still needs your numbers
- Glass price per square metre (placeholder $950).
- Wall frame, ceiling frame, foil, battens and fixings for medium and large jobs (only small
  jobs are calibrated from the Chandrajit sheet).
- Backrest: tool prices the timber only (about $180 on a 2 m bench); your sheet carried $315.
- Heater prices when you refresh the Narvi lists.

Questions: Joe Ingram, hello@leadhivenz.com, +61 0450 925 145.
