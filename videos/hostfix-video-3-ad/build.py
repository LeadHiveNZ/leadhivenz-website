#!/usr/bin/env python3
"""HostFix 'video 3' FB/IG property-manager ad: overlay layer only (headlines + subtitles + end card), rendered with transparency
and composited onto the untouched HDR footage. Edit = jump cuts from edl.json (frame ranges of the source;
every pause between phrases removed, audio untouched apart from the cuts), then the last frame held 1s."""
import json, html

EDL = json.load(open("edl.json"))["EDL_FRAMES"]
FPS, HOLD = 30, 1.0
SEGS, cum = [], 0
for a, b in EDL:
    SEGS.append((a / FPS, b / FPS, cum / FPS)); cum += b - a
SPEECH = cum / FPS
def omap(t):   # source seconds -> output seconds (times inside a removed gap snap to the next segment start)
    for a, b, o in SEGS:
        if t < a: return o
        if t <= b: return o + (t - a)
    return SPEECH
W, H = 1080, 1920
TOTAL = round(SPEECH + HOLD, 3)
PLUM, LIME = "#3b1e3f", "#d4f23a"
esc = lambda s: html.escape(s, quote=True)
def T(x): return f"{x:.3f}"

# ------------------------------------------------------------------ words (verbatim, spelling/number formatting only)
raw = json.load(open("words.json"))
FIX = {"tradeies": "tradies", "tradeies,": "tradies,", "trade's,": "tradies,", "ensure": "insured"}
def kept(t):   # words from the dropped first take (or any removed gap) are not subtitled
    return any(a - 0.3 <= t <= b for a, b, _ in SEGS)
words, i = [], 0
while i < len(raw):
    txt, nxt = raw[i]["text"], raw[i + 1]["text"] if i + 1 < len(raw) else ""
    st = raw[i]["start"]
    if txt == "Host" and nxt.startswith("Fix"):
        txt = "HostFix" + nxt[3:]; i += 1
    txt = FIX.get(txt, txt)
    if kept(st):
        words.append(dict(text=txt, t=round(max(omap(st), 0.05), 3), src=st))
    i += 1
for k in range(1, len(words)):
    words[k]["t"] = max(words[k]["t"], words[k - 1]["t"] + 0.06)
def atsrc(word, src_after):
    return next(w["t"] for w in words if w["text"].lower().strip(",.?!") == word and w["src"] >= src_after)
def at(word, after=0.0):
    return next(w["t"] for w in words if w["text"].lower().strip(",.?!") == word and w["t"] >= after)

# ------------------------------------------------------------------ subtitle chunks: <=2 lines (<=30 chars), break on punctuation / pauses
chunks, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    n = len(" ".join(x["text"] for x in cur))
    nn = n + 1 + len(nxt["text"]) if nxt else 0
    if nxt is None or w["text"][-1] in ".,?" and n >= 18 or w["text"][-1] in ".?" or nn > 34 or nxt["t"] - w["t"] > 0.75:
        chunks.append(cur); cur = []
SUB = []
for ci, c in enumerate(chunks):
    s = c[0]["t"] - 0.04
    nx = chunks[ci + 1][0]["t"] - 0.04 if ci + 1 < len(chunks) else SPEECH
    e = min(nx, c[-1]["t"] + 0.9)
    SUB.append((s, e, c))

# ------------------------------------------------------------------ headlines (key word in lime), each until the next
HL = [("h1", 'Property <em>managers</em> 👋', 0.08),
      ("h2", 'Every property, <em>one app</em>', atsrc("every", 17) - 0.05),
      ("h3", 'Cleaners report from their <em>phone</em>', atsrc("your", 20.5) - 0.05),
      ("h4", '<em>Photos + invoice</em> every job', atsrc("before", 26.5) - 0.05),
      ("h5", 'Let\'s <em>chat</em> 👇', atsrc("free", 31) - 0.05),
      ("end", 'HostFix · <em>Free to join</em>', SPEECH)]
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
.hl {{ position:absolute; left:60px; right:60px; top:215px; display:flex; justify-content:center; opacity:0; }}
.hbox {{ background:{PLUM}; color:#fff; font-family:'Nunito', sans-serif; font-weight:900; font-size:62px; line-height:1.15;
  padding:20px 38px 24px; border-radius:30px; text-align:center; box-shadow:0 12px 32px rgba(0,0,0,0.30); }}
#h3 .hbox {{ font-size:54px; white-space:nowrap; padding:20px 30px 24px; }}
.hbox em {{ font-style:normal; color:{LIME}; }}
.sub {{ position:absolute; left:70px; right:70px; top:1480px; height:200px; display:flex; align-items:center; justify-content:center; opacity:0; }}
.sub p {{ font-family:'Montserrat', sans-serif; font-weight:800; font-size:70px; line-height:1.16; color:#fff; text-align:center;
  -webkit-text-stroke:10px #000; paint-order:stroke fill; }}
.w {{ opacity:0; }}
.plist {{ position:absolute; left:120px; right:120px; top:362px; display:flex; flex-direction:column; gap:8px; }}
.row {{ display:flex; justify-content:space-between; align-items:baseline; gap:24px; padding:12px 34px; background:{PLUM}; border-radius:22px;
  font-family:'Nunito', sans-serif; font-weight:900; font-size:48px; line-height:1.15; color:#fff; opacity:0; box-shadow:0 10px 26px rgba(0,0,0,0.28); }}
.row b {{ color:{LIME}; font-weight:900; }}
"""
index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>HostFix video 3 ad overlay</title>
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
