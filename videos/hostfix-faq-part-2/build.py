#!/usr/bin/env python3
"""HostFix tradie FAQ part 2: animation + caption layer only, rendered with transparency and composited onto the
untouched HDR original (no cuts, no zoom, audio copied). Times are source seconds from transcript.json.
Face sits at y ~200-850 and the top 270 px is under the Reels UI, so everything lives between the chin and
the Reels bottom bar: question header (y 950), info cards (y 1070-1270), captions (y 1300-1470)."""
import json, html, re

W, H, TOTAL = 1080, 1920, 85.300
PLUM, LIME, CREAM = "#2B1631", "#D7EC4C", "#F5F2EA"
F = "'Montserrat', sans-serif"
esc = lambda s: html.escape(s, quote=True)
def T(x): return f"{x:.3f}"

# ------------------------------------------------------------------ words (+ spelling fixes)
raw = json.load(open("transcript.json"))
FIX = {"washes": "washers", "license": "licence", "$30.": "$30,", "AI": "AI"}
words, skip = [], False
raw = raw[2:]  # opening "Bugger it." stays in the audio, not captioned
for i, w in enumerate(raw):
    if skip:
        skip = False; continue
    txt, nxt = w["text"], raw[i + 1]["text"] if i + 1 < len(raw) else ""
    if txt.lower() == "host" and nxt.lower().startswith("fix"):
        txt, skip = "HostFix" + nxt[3:], True
    txt = FIX.get(txt, txt)
    words.append(dict(text=txt, start=round(w["start"], 3)))
words[0]["start"] = max(words[0]["start"], 0.12)
for k in range(1, len(words)):
    if words[k]["start"] < words[k - 1]["start"] + 0.07:
        words[k]["start"] = round(words[k - 1]["start"] + 0.07, 3)
def t(word, nth=0, after=0.0):
    hits = [w["start"] for w in words if w["text"].lower().strip(",.?!") == word.lower() and w["start"] >= after]
    return hits[nth]

# ------------------------------------------------------------------ caption groups (<=3 words, break on punctuation / pauses)
FUNC = {"the", "a", "an", "to", "of", "for", "in", "and", "your", "it's", "i", "on", "if", "so", "you", "is", "that", "as", "at", "or", "do", "my"}
KEY = set("""questions. two. bigger described? original quote quote. owner accept completely different time. deliberately fine. paid fee.
photo site why. parts materials calculated? $30, washers fixed price. common app. receipt 20%. $150, cannot accepted second visit visit. sign
up? business name, licence number, liability insurance, ministry justice check, free. bank detail. prove completed? gps house, count.
before afterwards. payment processed. faking ai timestamp. anything. know.""".split())
groups, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    end = w["text"][-1:] in ".?!,"
    if nxt is None or end or len(cur) >= 3 or nxt["start"] - w["start"] > 0.7:
        if len(cur) == 3 and not end and cur[-1]["text"].lower() in FUNC and nxt is not None:
            groups.append(cur[:-1]); cur = [cur[-1]]
        else:
            groups.append(cur); cur = []
if cur: groups.append(cur)
merged = []
for g in groups:
    if merged and len(g) == 1 and len(merged[-1]) < 3 and merged[-1][-1]["text"][-1:] not in ".?!" and g[0]["start"] - merged[-1][0]["start"] < 1.0:
        merged[-1] = merged[-1] + g
    else:
        merged.append(g)
CAP = []
for gi, g in enumerate(merged):
    s = g[0]["start"]
    nxt = merged[gi + 1][0]["start"] if gi + 1 < len(merged) else TOTAL
    e = min(nxt - 0.02, max(g[-1]["start"] + 0.55, s + 0.5))
    keys = [wi for wi, w in enumerate(g) if w["text"].lower().strip(",.?!") in KEY or w["text"] in KEY][-1:]
    CAP.append(dict(start=s, end=e, words=g, keys=keys))

ICON = {
    "q": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4.1 2.6c-.9.4-1.3 1-1.3 1.9v.4" fill="none" stroke="#2B1631" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.4" fill="#2B1631"/></svg>',
    "check": '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "phone": '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="18" r="1.3" fill="currentColor"/></svg>',
    "clock": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "card": '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M2 10h20" stroke="currentColor" stroke-width="2.4"/></svg>',
    "shield": '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="currentColor"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#2B1631" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "tag": '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" fill="currentColor"/><circle cx="7.5" cy="8" r="1.8" fill="#2B1631"/></svg>',
    "x": '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
    "user": '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>',
    "door": '<svg viewBox="0 0 24 24"><path d="M5 3h10v18H5z" fill="currentColor"/><path d="M15 5l4 1.5v12L15 20z" fill="#D7EC4C"/><circle cx="12.5" cy="12" r="1.2" fill="#D7EC4C"/></svg>',
}
def ic(name, cls=""): return f'<i class="{cls}">{ICON[name]}</i>'
over, js = [], []
def enter(sel, at, dy=20, dur=0.4):
    js.append(f'tl.fromTo("{sel}", {{ opacity: 0, y: {dy} }}, {{ opacity: 1, y: 0, duration: {dur}, ease: "power2.out" }}, {T(at)});')
def leave(sel, at, dur=0.3):
    js.append(f'tl.to("{sel}", {{ opacity: 0, duration: {dur}, ease: "power1.in" }}, {T(at - dur)});')
    js.append(f'tl.set("{sel}", {{ visibility: "hidden" }}, {T(at)});')

# ------------------------------------------------------------------ question headers (chapters)
QS = [("intro", "HOSTFIX · TRADIE FAQ · PART 2", None, 0.10, t("what") - 0.05),
      ("q1", "Job bigger than described?", "Q1", t("what") - 0.05, t("what", 1) - 0.05),
      ("q2", "A totally different job?", "Q2", t("what", 1) - 0.05, t("how") - 0.05),
      ("q3", "How are parts charged?", "Q3", t("how") - 0.05, t("what", 2) - 0.05),
      ("q4", "Need to come back?", "Q4", t("what", 2) - 0.05, t("what", 3) - 0.05),
      ("q5", "What do I need to sign up?", "Q5", t("what", 3) - 0.05, t("how", 1) - 0.05),
      ("q6", "How do I prove I was there?", "Q6", t("how", 1) - 0.05, t("if", after=83) - 0.05),
      ("out", "Got questions? Let me know", None, t("if", after=83) - 0.05, TOTAL + 0.5)]
NQ = 6
for qid, label, num, a, b in QS:
    badge = f'<b class="qn">{num}</b>' if num else f'{ic("door","dr")}'
    over.append(f'<div class="qhead" id="{qid}"><div class="qbox">{badge}<span>{esc(label)}</span></div></div>')
    enter(f"#{qid}", a, 16, 0.45)
    if b < TOTAL:
        leave(f"#{qid}", b)
dots = "".join(f'<span class="dot" id="dt{k}"></span>' for k in range(NQ))
over.append(f'<div class="dots" id="dots">{dots}</div>')
enter("#dots", QS[1][3], 0, 0.4)
for k in range(NQ):
    js.append(f'tl.to("#dt{k}", {{ backgroundColor: "{LIME}", scale: 1.25, duration: 0.3, ease: "power2.out" }}, {T(QS[k + 1][3] + 0.1)});')
    js.append(f'tl.to("#dt{k}", {{ scale: 1, duration: 0.2 }}, {T(QS[k + 1][3] + 0.45)});')
leave("#dots", QS[-1][3] + 0.3)

# ------------------------------------------------------------------ info cards (one at a time, centred)
CARDS = []
def card(cid, inner, at, until, cls=""):
    CARDS.append((at, until))
    over.append(f'<div class="cardrow" id="{cid}"><div class="card {cls}">{inner}</div></div>')
    enter(f"#{cid}", at, 18, 0.35)
    leave(f"#{cid}", until, 0.25)
CAM = '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v12H3z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>'
PIN = '<svg viewBox="0 0 24 24"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="currentColor"/><circle cx="12" cy="9.5" r="2.6" fill="#2B1631"/></svg>'
ICON["cam"], ICON["pin"] = CAM, PIN
AR = f'<span class="ar">{ICON["arrow"]}</span>'
ck = lambda n: f'<span class="ct">{n}/5</span>'
seq = [
    ("c1", f'{ic("check","lm")}Do the original job first', t("do") - 0.1, t("then") - 0.05, ""),
    ("c2", f'{ic("phone","lm")}Tap “Add a quote” for the extra', t("add") - 0.15, t("the", after=10) - 0.05, ""),
    ("c3", f'{ic("user")}Owner accepts before you finish', t("owner") - 0.1, t("what", 1) - 0.1, "lime"),
    ("c4", f'{ic("user","lm")}Some don’t know · some try it on', t("people") - 0.1, t("that's") - 0.05, ""),
    ("c5", f'{ic("check")}That’s absolutely fine', t("that's") - 0.05, t("you're") - 0.05, "lime"),
    ("c6", f'{ic("card")}You’re still paid the call-out fee', t("you're") - 0.05, t("you", after=23.9) - 0.05, "lime"),
    ("c7", f'{ic("cam","lm")}Photo the site + explain why', t("take") - 0.1, t("how") - 0.1, ""),
    ("c8", f'{ic("tag")}Under <b class="big">$30</b> = included', t("anything") - 0.05, t("anything", 1) - 0.05, "lime"),
    ("c9", f'{ic("tag","lm")}Common parts: fixed price in the app', t("anything", 1) - 0.05, t("and", after=37) - 0.05, ""),
    ("c10", f'{ic("tag")}Everything else: receipt <b class="big">+20%</b>', t("and", after=37) - 0.05, t("anything", 3) - 0.05, "lime"),
    ("c11", f'{ic("shield","lm")}<span>Over <b class="big">$150</b>? Owner approves first</span>', t("anything", 3) - 0.05, t("what", 2) - 0.1, ""),
    ("c12", f'{ic("check","lm")}Add the 2nd visit to your quote', t("put") - 0.1, t("there's", after=48) - 0.05, ""),
    ("c13", f'{ic("x")}No second call-out fee', t("there's", after=48) - 0.05, t("what", 3) - 0.1, "lime"),
    ("c14", f'{ic("check","lm")}Business name{ck(1)}', t("business") - 0.1, t("your", after=52.8) - 0.05, "cl"),
    ("c15", f'{ic("check","lm")}Licence number{ck(2)}', t("your", after=52.8) - 0.05, t("a", after=53.9) - 0.05, "cl"),
    ("c16", f'{ic("check","lm")}Public liability insurance{ck(3)}', t("a", after=53.9) - 0.05, t("and", after=55.4) - 0.05, "cl"),
    ("c17", f'{ic("check","lm")}Ministry of Justice check{ck(4)}', t("and", after=55.4) - 0.05, t("which") - 0.05, "cl"),
    ("c17b", f'{ic("check")}Ministry of Justice check: <b class="big">FREE</b>', t("which") - 0.05, t("and", after=58.8) - 0.05, "lime"),
    ("c18", f'{ic("check","lm")}Bank details{ck(5)}', t("and", after=58.8) - 0.05, t("how", 1) - 0.1, "cl"),
    ("c19", f'{ic("pin")}Inbuilt GPS: you must be at the house', t("inbuilt") - 0.1, t("you", after=68) - 0.05, "lime"),
    ("c21", f'{ic("card")}After photo = payment processed', t("straight") - 0.1, t("so", after=76) - 0.05, "lime"),
    ("c22", f'{ic("x","lm")}No faking jobs · no AI photos', t("so", after=76) - 0.05, t("it's", after=78.5) - 0.05, ""),
    ("c23", f'{ic("clock","lm")}All taken in-app with a timestamp', t("it's", after=78.5) - 0.05, t("so", after=81) - 0.05, ""),
    ("c24", f'{ic("shield")}No way around it', t("so", after=81) - 0.05, t("if", after=83) - 0.1, "lime"),
]
for cid, inner, a, b, cls in seq:
    card(cid, inner, a, b, cls)
# photo sequence card: House -> Before -> After, each step lands on its word
pa, pb = t("you", after=68) - 0.05, t("straight") - 0.1
CARDS.append((pa, pb))
steps = [("ph1", "House", t("house", 2)), ("ph2", "Before", t("before")), ("ph3", "After", t("afterwards"))]
inner = f'{ic("cam","lm")}' + AR.join(f'<span class="stp" id="{sid}">{lab}</span>' for sid, lab, _ in steps)
over.append(f'<div class="cardrow" id="c20"><div class="card"><div class="split">{inner}</div></div></div>')
enter("#c20", pa, 18, 0.35)
for sid, lab, at in steps:
    js.append(f'tl.to("#{sid}", {{ color: "{LIME}", scale: 1.12, duration: 0.25, ease: "back.out(2)" }}, {T(at)});')
    js.append(f'tl.to("#{sid}", {{ scale: 1, duration: 0.2 }}, {T(at + 0.3)});')
leave("#c20", pb, 0.25)

# ------------------------------------------------------------------ captions
for gi, g in enumerate(CAP):
    spans = "".join(f'<span class="cw{" key" if wi in g["keys"] else ""}" id="cw{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    over.append(f'<div class="cg" id="cg{gi}">{spans}</div>')
    js.append(f'tl.set("#cg{gi}", {{ opacity: 1 }}, {T(g["start"])});')
    for wi, w in enumerate(g["words"]):
        js.append(f'tl.fromTo("#cw{gi}-{wi}", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }}, {T(max(g["start"], w["start"]))});')
    js.append(f'tl.set("#cg{gi}", {{ opacity: 0, visibility: "hidden" }}, {T(g["end"])});')
js.append(f'tl.set({{}}, {{}}, {T(TOTAL)});')

# fromTo -> set + to so nothing shows before its cue
_ft = re.compile(r'^tl\.fromTo\("([^"]+)", (\{.*?\}), \{ (.*) \}, ([0-9.]+)\);$')
for k, l in enumerate(js):
    m = _ft.match(l)
    if m and float(m.group(4)) > 0:
        js[k] = f'tl.set("{m.group(1)}", {m.group(2)}, {m.group(4)}); tl.to("{m.group(1)}", {{ {m.group(3)} }}, {m.group(4)});'

css = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:transparent; }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:transparent; font-family:{F}; }}
i {{ display:inline-flex; width:42px; height:42px; flex:none; }}
i svg {{ width:100%; height:100%; }}
i.lm {{ color:{LIME}; }}
.qhead {{ position:absolute; left:0; right:0; top:1015px; display:flex; justify-content:center; opacity:0; }}
.qbox {{ display:flex; align-items:center; gap:16px; padding:12px 30px 12px 14px; border-radius:999px; background:{CREAM}; color:{PLUM};
  font-weight:800; font-size:40px; white-space:nowrap; box-shadow:0 14px 34px rgba(0,0,0,0.35); }}
.qn {{ display:flex; align-items:center; justify-content:center; width:66px; height:66px; border-radius:50%; background:{PLUM}; color:{LIME}; font-size:30px; }}
.qbox i.dr {{ width:56px; height:56px; color:{PLUM}; margin-left:10px; }}
.dots {{ position:absolute; left:0; right:0; top:1112px; display:flex; justify-content:center; gap:12px; opacity:0; }}
.dot {{ width:14px; height:14px; border-radius:50%; background:rgba(245,242,234,0.55); display:block; box-shadow:0 2px 6px rgba(0,0,0,0.3); }}
.cardrow {{ position:absolute; left:0; right:0; top:1150px; display:flex; justify-content:center; opacity:0; }}
.card {{ display:inline-flex; align-items:center; gap:14px; padding:16px 30px; border-radius:26px; background:rgba(43,22,49,0.94); color:#fff;
  font-weight:800; font-size:38px; white-space:nowrap; box-shadow:0 14px 34px rgba(0,0,0,0.35); }}
.card.lime {{ background:{LIME}; color:{PLUM}; }}
.card b.big {{ font-size:52px; line-height:1; color:{LIME}; }}
.card.lime b.big {{ color:{PLUM}; }}
.split {{ display:flex; align-items:center; gap:14px; }}
.split b {{ color:{LIME}; font-size:46px; }}
.split .ar {{ display:inline-flex; width:38px; height:38px; color:{LIME}; }}
.split .ar svg {{ width:100%; height:100%; }}
.split .sep {{ opacity:0.6; }}
.card .ct {{ margin-left:8px; padding:4px 14px; border-radius:999px; background:{LIME}; color:{PLUM}; font-size:28px; }}
.stp {{ display:inline-block; color:rgba(255,255,255,0.55); }}
.split .ar {{ opacity:0.7; }}
.cg {{ position:absolute; left:60px; right:60px; top:1305px; height:205px; display:flex; flex-wrap:wrap; justify-content:center; align-content:center;
  gap:0 22px; opacity:0; }}
.cw {{ display:inline-block; font-weight:800; font-size:72px; line-height:1.12; color:#fff; letter-spacing:-0.01em; opacity:0;
  -webkit-text-stroke:3px rgba(0,0,0,0.85); paint-order:stroke fill; text-shadow:0 5px 0 rgba(0,0,0,0.55), 0 8px 26px rgba(0,0,0,0.55); }}
.cw.key {{ color:{LIME}; }}
"""
index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>HostFix tradie FAQ part 2 overlay</title>
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
open("captions.srt", "w").write("\n".join(f"{k + 1}\n{stamp(g['start'])} --> {stamp(g['end'])}\n{' '.join(w['text'] for w in g['words'])}\n" for k, g in enumerate(CAP)))
open("transcript.txt", "w").write(" ".join(w["text"] for w in words) + "\n")
overlaps = [(a, b) for (a, b), (c, d) in zip(sorted(CARDS), sorted(CARDS)[1:]) if b > c + 0.01]
print(f"{len(CAP)} caption groups, {len(seq)} cards, {len(QS)} headers; card overlaps: {overlaps}")
