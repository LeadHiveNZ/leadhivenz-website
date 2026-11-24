#!/usr/bin/env python3
"""HostFix 'video 1' FB/IG ad: overlay layer only (headlines + subtitles + end card), rendered with transparency
and composited onto the untouched HDR footage. Edit = head trim to the final take (src 9.40s) and tail trim
(src 41.60s), then the last frame held 1s. Output time = source time - IN."""
import json, html

IN, OUT, HOLD = 9.40, 41.60, 1.0
W, H = 1080, 1920
TOTAL = round(OUT - IN + HOLD, 3)
PLUM, LIME = "#3b1e3f", "#d4f23a"
esc = lambda s: html.escape(s, quote=True)
def T(x): return f"{x:.3f}"

# ------------------------------------------------------------------ words (verbatim, spelling/number formatting only)
raw = json.load(open("words.json"))
FIX = {"three,": "3,", "toilets": "toilet's", "plumbers": "plumber's", "tradey": "tradie", "thirty": "30"}
words, i = [], 0
while i < len(raw):
    txt, nxt = raw[i]["text"], raw[i + 1]["text"] if i + 1 < len(raw) else ""
    st = raw[i]["start"]
    if txt == "Host" and nxt.startswith("Fix"):
        txt = "HostFix" + nxt[3:]; i += 1
    elif txt == "twenty" and nxt == "four":
        txt = "24"; i += 1
    elif txt == "four" and st > 26.5:
        txt = "4"
    txt = FIX.get(txt, txt)
    words.append(dict(text=txt, t=round(max(st - IN, 0.05), 3)))
    i += 1
for k in range(1, len(words)):
    words[k]["t"] = max(words[k]["t"], words[k - 1]["t"] + 0.06)
def at(word, after=0.0):
    return next(w["t"] for w in words if w["text"].lower().strip(",.?!") == word and w["t"] >= after)

# ------------------------------------------------------------------ subtitle chunks: <=2 lines (<=30 chars), break on punctuation / pauses
chunks, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    n = len(" ".join(x["text"] for x in cur))
    nn = n + 1 + len(nxt["text"]) if nxt else 0
    if nxt is None or w["text"][-1] in ".,?" and n >= 12 or w["text"][-1] in ".?" or nn > 30 or nxt["t"] - w["t"] > 0.75:
        chunks.append(cur); cur = []
SUB = []
for ci, c in enumerate(chunks):
    s = c[0]["t"] - 0.04
    nx = chunks[ci + 1][0]["t"] - 0.04 if ci + 1 < len(chunks) else OUT - IN
    e = min(nx, c[-1]["t"] + 0.9)
    SUB.append((s, e, c))

# ------------------------------------------------------------------ headlines (key word in lime), each until the next
HL = [("h1", 'Guest checks in at <em>3pm</em> 😬', 0.08),
      ("h2", 'Report it in <em>30 seconds</em>', at("report") - 0.05),
      ("h3", 'Insured tradie in <em>24 hrs</em>', at("a", 14) - 0.05),
      ("h4", 'Fixed price <em>✓</em> Photos <em>✓</em>', at("fixed") - 0.05),
      ("h5", '<em>Free</em> to join 👇', at("free") - 0.05),
      ("end", 'HostFix · <em>Free to join</em>', OUT - IN)]
over, js = [], []
for k, (hid, inner, a) in enumerate(HL):
    b = HL[k + 1][2] if k + 1 < len(HL) else None
    over.append(f'<div class="hl{" endc" if hid == "end" else ""}" id="{hid}"><div class="hbox">{inner}</div></div>')
    js.append(f'tl.set("#{hid}", {{ opacity: 0 }}, 0);')
    js.append(f'tl.to("#{hid}", {{ opacity: 1, duration: 0.35, ease: "power1.out" }}, {T(a)});')
    if b is not None:
        js.append(f'tl.to("#{hid}", {{ opacity: 0, duration: 0.2, ease: "power1.in" }}, {T(b - 0.2)});')
        js.append(f'tl.set("#{hid}", {{ visibility: "hidden" }}, {T(b)});')

for gi, (s, e, c) in enumerate(SUB):
    spans = " ".join(f'<span class="w" id="w{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(c))
    over.append(f'<div class="sub" id="s{gi}"><p>{spans}</p></div>')
    js.append(f'tl.set("#s{gi}", {{ opacity: 0 }}, 0);')
    js.append(f'tl.set("#s{gi}", {{ opacity: 1 }}, {T(s)});')
    for wi, w in enumerate(c):
        js.append(f'tl.set("#w{gi}-{wi}", {{ opacity: 0.0 }}, 0);')
        js.append(f'tl.set("#w{gi}-{wi}", {{ opacity: 1 }}, {T(max(s, w["t"] - 0.03))});')
    js.append(f'tl.set("#s{gi}", {{ opacity: 0, visibility: "hidden" }}, {T(e)});')
js.append(f'tl.set({{}}, {{}}, {T(TOTAL)});')

css = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:transparent; }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:transparent; }}
.hl {{ position:absolute; left:60px; right:60px; top:290px; display:flex; justify-content:center; opacity:0; }}
.hbox {{ background:{PLUM}; color:#fff; font-family:'Nunito', sans-serif; font-weight:900; font-size:62px; line-height:1.15;
  padding:20px 38px 24px; border-radius:30px; text-align:center; box-shadow:0 12px 32px rgba(0,0,0,0.30); }}
.hbox em {{ font-style:normal; color:{LIME}; }}
.sub {{ position:absolute; left:70px; right:70px; top:1395px; height:200px; display:flex; align-items:center; justify-content:center; opacity:0; }}
.sub p {{ font-family:'Montserrat', sans-serif; font-weight:800; font-size:70px; line-height:1.16; color:#fff; text-align:center;
  -webkit-text-stroke:10px #000; paint-order:stroke fill; }}
.w {{ opacity:0; }}
"""
index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>HostFix video 1 ad overlay</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{T(TOTAL)}">
{chr(10).join('      ' + o for o in over)}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join('      ' + l for l in js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
def stamp(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s_:02d},{ms:03d}"
open("captions.srt", "w").write("\n".join(f"{k + 1}\n{stamp(s)} --> {stamp(e)}\n{' '.join(w['text'] for w in c)}\n" for k, (s, e, c) in enumerate(SUB)))
open("transcript.txt", "w").write(" ".join(w["text"] for w in words) + "\n")
print(f"TOTAL {TOTAL}s, {len(SUB)} subtitle chunks; headlines at", [round(h[2], 2) for h in HL])
for s, e, c in SUB: print(f"{s:6.2f}-{e:6.2f} {' '.join(w['text'] for w in c)}")
