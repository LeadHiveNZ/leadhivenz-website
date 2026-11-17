#!/usr/bin/env python3
"""Claude workshop recap: one take cut tight (stumbles, retakes, pauses out), app B-roll for the land developer
and caravan bar, motion graphics, word-by-word captions. Videoleap logo delogo'd 0.25-3.2 s in assets/source.mp4."""
import json, html, re

W, H = 1080, 1920
NAVY, NAVY2, GOLD, CREAM, INK = "#0A1628", "#16243C", "#FFB900", "#F5F2EA", "#060D18"
GREEN, RED = "#2FB36B", "#E5484D"
CAPF = "'Montserrat', sans-serif"
UI = "'Inter', 'Montserrat', sans-serif"

c = json.load(open("edl.json"))
D = c["D"]
segs, t = [], 0.0
for i, (a, b) in enumerate(c["EDL"]):
    s = t if i == 0 else t - D
    segs.append(dict(src_in=a, src_out=b, out_in=round(s, 3), out_out=round(s + b - a, 3)))
    t = s + b - a
TOTAL = round(t, 3)

def to_out(s):
    for sg in segs:
        if sg["src_in"] - 0.001 <= s <= sg["src_out"] + 0.001:
            return round(sg["out_in"] + (s - sg["src_in"]), 3)
    raise ValueError(s)
def T(x): return f"{x:.3f}"
def esc(s): return html.escape(s, quote=True)

# ------------------------------------------------------------------ words
raw = json.load(open("transcript.json"))
words = []
skip = False
for i, w in enumerate(raw):
    if skip:
        skip = False; continue
    txt, st = w["text"], w["start"]
    tol = 0.3 if txt.endswith(".") else 0.12          # ASR stamps sentence-final words late
    seg = next((k for k, sg in enumerate(segs) if sg["src_in"] <= st <= sg["src_out"]), None)   # inside a kept range first
    if seg is None:
        seg = next((k for k, sg in enumerate(segs) if sg["src_in"] - 0.3 <= st <= sg["src_out"] + tol), None)
    if seg is None:
        continue
    txt = {"trady-specific": "tradie-specific", "one-on-one,": "one-on-ones,"}.get(txt, txt)
    st = max(st, segs[seg]["src_in"] + 0.03)
    words.append(dict(text=txt, start=to_out(min(st, segs[seg]["src_out"] - 0.05)), seg=seg))
for k, w in enumerate(words):
    if w["seg"] == 2 and w["text"] == "5":
        w["text"] = "50"                           # a clean re-listen of this line hears "fifty"
    last_in_seg = k + 1 == len(words) or words[k + 1]["seg"] != w["seg"]
    if last_in_seg and w["seg"] in (5, 6, 7, 8) and w["text"][-1:] not in ".,?!":
        w["text"] += "."
for k, w in enumerate(words):
    if k and words[k - 1]["text"][-1:] in ".?!" and w["text"][:1].islower():
        w["text"] = w["text"][:1].upper() + w["text"][1:]
for k in range(1, len(words)):
    if words[k]["start"] < words[k - 1]["start"] + 0.07:
        words[k]["start"] = round(words[k - 1]["start"] + 0.07, 3)
def word_t(text, seg, nth=0):
    hits = [w["start"] for w in words if w["seg"] == seg and w["text"].lower().strip(",.") == text.lower()]
    return hits[nth]

# ------------------------------------------------------------------ captions (2-3 words, key word gold)
KEY = set("""28th october claude ai workshop 50 businesses zealand australia live 10 automated emails invoicing quoting scheduling winning jobs time software developer projects caravan bar instagram website 14 days promise refund link five hours admin bucks""".split())
groups = []
phrase = []                      # split at sentence/clause ends and segment changes, then chunk in threes
for k, w in enumerate(words):
    phrase.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    if nxt is None or w["text"][-1:] in ".,?!" or nxt["seg"] != w["seg"]:
        chunks = [phrase[i:i + 3] for i in range(0, len(phrase), 3)]
        if len(chunks) > 1 and len(chunks[-1]) == 1:
            last = chunks.pop(); chunks[-1] = chunks[-1] + last
        FUNC = {"the", "a", "to", "of", "for", "in", "and", "your", "it's", "i'll", "is", "i", "on", "some", "if", "so"}
        for j in range(len(chunks) - 1):     # never end a line on a function word: hand it to the next line
            while len(chunks[j]) > 1 and chunks[j][-1]["text"].lower() in FUNC and len(chunks[j + 1]) < 4:
                chunks[j + 1].insert(0, chunks[j].pop())
        groups += chunks
        phrase = []
# a one-word clause ("below,") joins its neighbour in the same segment
merged = []
for g in groups:
    if merged and len(g) == 1 and len(merged[-1]) <= 3 and merged[-1][-1]["seg"] == g[0]["seg"] and merged[-1][-1]["text"][-1:] != ".":
        merged[-1] = merged[-1] + g
    else:
        merged.append(g)
groups = merged
# a lone word that would flash (< 0.4 s) rides with the next line in the same segment
k = 0
while k < len(groups) - 1:
    g, n = groups[k], groups[k + 1]
    if len(g) == 1 and n[0]["start"] - g[0]["start"] < 0.4 and n[0]["seg"] == g[0]["seg"] and len(n) <= 4:
        groups[k:k + 2] = [g + n]
    else:
        k += 1
CAP = []
for gi, g in enumerate(groups):
    s = g[0]["start"]
    seg_end = segs[g[-1]["seg"]]["out_out"]
    nxt = groups[gi + 1][0]["start"] if gi + 1 < len(groups) else TOTAL
    e = min(nxt - 0.02, max(g[-1]["start"] + 0.5, s + 0.45), seg_end + 0.25 if gi + 1 < len(groups) else TOTAL)
    keys = [wi for wi, w in enumerate(g) if w["text"].lower().strip(",.") in KEY][-2:]
    CAP.append(dict(start=s, end=e, words=g, keys=keys))

js = []
# ------------------------------------------------------------------ footage + punch-ins
FACE = (540, 820)
clips = []
for i, sg in enumerate(segs):
    clips.append(f'<video id="v{i}" class="clip" src="assets/source.mp4" muted playsinline data-start="{T(sg["out_in"])}" '
                 f'data-duration="{T(sg["out_out"] - sg["out_in"])}" data-media-start="{T(sg["src_in"])}" data-track-index="0"></video>')
    js.append(f'tl.set("#cam", {{ scale: {1.0 if i % 2 == 0 else 1.075} }}, {T(sg["out_in"])});')
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("i", 0))});')              # beats inside the longer takes
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("and", 1))});')
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("invoicing,", 2) if False else word_t("quoting", 2))});')
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("how", 5))});')
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("if", 9))});')

over = []   # overlay html
def show(sel, t_in, t_out, frm="{ opacity: 0, y: 24, scale: 0.92 }", dur=0.28, ease="back.out(1.8)", out="{ opacity: 0, y: -14, duration: 0.18, ease: \"power2.in\" }"):
    js.append(f'tl.fromTo("{sel}", {frm}, {{ opacity: 1, y: 0, x: 0, scale: 1, duration: {dur}, ease: "{ease}" }}, {T(t_in)});')
    js.append(f'tl.to("{sel}", {out}, {T(t_out - 0.18)});')

ICON = {
    "bolt": '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>',
    "pin": '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="currentColor"/></svg>',
    "check": '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "x": '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
    "clock": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    "shield": '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="currentColor"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#111A2E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "home": '<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="currentColor"/></svg>',
    "down": '<svg viewBox="0 0 24 24"><path d="M12 4v14M5 12l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "user": '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>',
}


ICON.update({
    "cal": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    "spark": '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor"/></svg>',
    "trophy": '<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0zM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4M10 15h4v3h3v3H7v-3h3z" fill="currentColor"/></svg>',
    "wrench": '<svg viewBox="0 0 24 24"><path d="M20.5 6.5a5 5 0 0 1-6.6 6.6L7 20l-3-3 6.9-6.9a5 5 0 0 1 6.6-6.6L14 7l3 3z" fill="currentColor"/></svg>',
    "globe": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    "ig": '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="17.3" cy="6.7" r="1.4" fill="currentColor"/></svg>',
    "grid": '<svg viewBox="0 0 24 24"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="currentColor"/></svg>',
})
def ts(text, seg, nth=0):
    return word_t(text, seg, nth)

# opening banner over the band where the Videoleap logo was removed (source 0.25-3.2 s)
WM_END = to_out(3.2) + 0.1
over.append(f'<div class="wanted" id="wanted"><i>{ICON["spark"]}</i>TRADIE AI WORKSHOP</div>')
js.append(f'tl.fromTo("#wanted", {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }}, 0.001);')
js.append(f'tl.to("#wanted", {{ opacity: 0, y: 40, duration: 0.2, ease: "power2.in" }}, {T(WM_END)});')

# ------------------------------------------------------------------ 1. 28 October, Claude AI workshop (seg 0)
s0 = segs[0]
over.append(f'<div class="top" id="hook"><div class="pill gold" id="h1"><i>{ICON["cal"]}</i>28 OCTOBER</div>'
            f'<div class="pill dark" id="h2"><i class="g">{ICON["spark"]}</i>Claude AI workshop for tradies</div></div>')
show("#h1", ts("28th", 0) - 0.05, s0["out_out"] + 0.05)
show("#h2", ts("claude", 0) - 0.05, s0["out_out"] + 0.05)

# ------------------------------------------------------------------ 2. 50 attended live, +10 after (seg 1)
s1 = segs[1]
over.append(f'<div class="top" id="att"><div class="ctile" id="a1"><div class="cnum" id="n50">0</div><div class="clab">BUSINESSES<br>ATTENDED LIVE</div></div>'
            f'<div class="row2"><span class="pill dark sm" id="a2">NZ</span><span class="pill dark sm" id="a3">AUSTRALIA</span>'
            f'<span class="pill gold sm" id="a4">+<b id="n10">0</b>&nbsp;after</span></div></div>')
show("#a1", ts("50", 1) - 0.1, s1["out_out"] + 0.05, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.2)")
js.append(f'tl.to("#n50", {{ duration: 0.55, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n50", 50] }}, {T(ts("50", 1) - 0.05)});')
show("#a2", ts("new", 1) - 0.05, s1["out_out"] + 0.05)
show("#a3", ts("australia", 1) - 0.05, s1["out_out"] + 0.05)
show("#a4", ts("10", 1) - 0.08, s1["out_out"] + 0.05)
js.append(f'tl.to("#n10", {{ duration: 0.35, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n10", 10] }}, {T(ts("10", 1) - 0.02)});')

# ------------------------------------------------------------------ 3. automated list (seg 2), then winning / time (segs 3-4)
s2, s3, s4 = segs[2], segs[3], segs[4]
items = [("emails", "Emails"), ("invoicing", "Invoicing"), ("quoting", "Quoting"), ("scheduling", "Scheduling")]
rows = "".join(f'<div class="trow" id="tr{k}"><i>{ICON["check"]}</i>{lab}</div>' for k, (w, lab) in enumerate(items))
over.append(f'<div class="top" id="auto"><div class="pill gold" id="au0"><i>{ICON["bolt"]}</i>AUTOMATED</div><div class="tgrid">{rows}</div></div>')
show("#au0", ts("automated", 2) - 0.05, s2["out_out"] + 0.05)
for k, (w, lab) in enumerate(items):
    show(f"#tr{k}", ts(w, 2) - 0.05, s2["out_out"] + 0.05, frm="{ opacity: 0, y: 0, x: -30, scale: 0.9 }", ease="back.out(2)")
over.append(f'<div class="top" id="win"><div class="pill gold big" id="w1"><i>{ICON["trophy"]}</i>Winning more quotes</div>'
            f'<div class="pill dark" id="w2"><i class="g">{ICON["wrench"]}</i>More time on the tools</div></div>')
show("#w1", ts("winning", 3) - 0.05, s4["out_out"] + 0.05)
show("#w2", ts("spending", 4) - 0.05, s4["out_out"] + 0.05)

# ------------------------------------------------------------------ 4. one-on-ones -> B-roll: land developer (seg 5), caravan bar (seg 6)
s5, s6 = segs[5], segs[6]
over.append(f'<div class="top" id="own"><div class="pill dark" id="o1"><i class="g">{ICON["grid"]}</i>Their own software</div></div>')
show("#o1", ts("software", 5) - 0.05, ts("like", 5))
B1_IN = ts("land", 5) - 0.25
B1_DUR = min(6.3, s5["out_out"] - B1_IN)
B2_IN = s6["out_in"]
B2_DUR = min(4.75, s6["out_out"] - B2_IN)
clips.append(f'<video id="vb1" class="clip broll" src="assets/broll_dev.mp4" muted playsinline data-start="{T(B1_IN)}" data-duration="{T(B1_DUR)}" data-media-start="0.00" data-track-index="1"></video>')
clips.append(f'<video id="vb2" class="clip broll" src="assets/broll_bar.mp4" muted playsinline data-start="{T(B2_IN)}" data-duration="{T(B2_DUR)}" data-media-start="0.00" data-track-index="1"></video>')
over.append(f'<div class="btag" id="bt1"><i>{ICON["grid"]}</i>Land developer · every project in one place</div>')
over.append(f'<div class="btag" id="bt2"><i>{ICON["ig"]}</i>Caravan bar · jobs auto-post to Instagram</div>')
show("#bt1", B1_IN + 0.15, B1_IN + B1_DUR)
show("#bt2", B2_IN + 0.15, B2_IN + B2_DUR)
js.append(f'tl.fromTo("#broll", {{ scale: 1.08 }}, {{ scale: 1.0, duration: {B1_DUR:.3f}, ease: "none" }}, {T(B1_IN)});')
js.append(f'tl.fromTo("#broll", {{ scale: 1.0 }}, {{ scale: 1.08, duration: {B2_DUR:.3f}, ease: "none", immediateRender: false }}, {T(B2_IN)});')

# ------------------------------------------------------------------ 5. websites (seg 7), 14 days (seg 8), refund (seg 9)
s7, s8, s9 = segs[7], segs[8], segs[9]
over.append(f'<div class="top" id="web"><div class="pill gold" id="we1"><i>{ICON["globe"]}</i>New websites built</div></div>')
show("#we1", ts("restructured", 7) - 0.05, s7["out_out"] + 0.05)
over.append(f'<div class="top" id="days"><div class="ctile" id="d1"><div class="cnum" id="n14">0</div><div class="clab">DAYS<br>ONLY</div></div>'
            f'<div class="pill dark" id="d2"><i class="g">{ICON["play"] if "play" in ICON else ICON["spark"]}</i>Workshop access</div></div>')
show("#d2", ts("access", 8) - 0.05, s8["out_out"] + 0.05)
show("#d1", ts("14", 8) - 0.1, s8["out_out"] + 0.05, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.2)")
js.append(f'tl.to("#n14", {{ duration: 0.4, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n14", 14] }}, {T(ts("14", 8) - 0.05)});')
over.append(f'<div class="top" id="ref"><div class="pill gold big" id="r1"><i>{ICON["shield"]}</i>Full refund guarantee</div>'
            f'<div class="pill dark" id="r2">No questions asked</div></div>')
show("#r1", ts("promise", 9) - 0.05, s9["out_out"] + 0.05)
show("#r2", ts("questions", 9) - 0.1, s9["out_out"] + 0.05)

# ------------------------------------------------------------------ 6. CTA (segs 10-11)
s10, s11 = segs[10], segs[11]
over.append(f'<div class="cta" id="cta"><i>{ICON["down"]}</i>LINK BELOW</div>')
show("#cta", ts("click", 10) - 0.05, TOTAL + 0.2)
js.append(f'tl.to("#cta i", {{ y: 10, duration: 0.3, repeat: 7, yoyo: true, ease: "sine.inOut" }}, {T(ts("click", 10) + 0.25)});')
over.append(f'<div class="top" id="save"><div class="pill dark" id="sv1"><i class="g">{ICON["clock"]}</i>Save 5 hours of admin a week</div></div>'
            f'<div class="price" id="price">$50</div>')
show("#sv1", ts("five", 10) - 0.08, TOTAL + 0.2)
js.append(f'tl.fromTo("#price", {{ opacity: 0, scale: 2.6, rotation: -24 }}, {{ opacity: 1, scale: 1, rotation: -8, duration: 0.2, ease: "power4.in" }}, {T(ts("50", 11) - 0.08)});')
SFX = [B1_IN, B2_IN]

# ------------------------------------------------------------------ captions
cb = []
for gi, g in enumerate(CAP):
    spans = "".join(f'<span class="cw{" key" if wi in g["keys"] else ""}" id="cw{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    early = " early" if g["start"] < WM_END + 0.2 else ""
    cb.append(f'<div class="cg{early}" id="cg{gi}">{spans}</div>')
    js.append(f'tl.set("#cg{gi}", {{ opacity: 1 }}, {T(g["start"])});')
    for wi, w in enumerate(g["words"]):
        ws = max(g["start"], w["start"])
        pop = 1.0
        js.append(f'tl.fromTo("#cw{gi}-{wi}", {{ opacity: 0, y: 14, scale: 0.86 }}, {{ opacity: 1, y: 0, scale: {pop}, duration: 0.12, ease: "back.out(2.2)" }}, {T(ws)});')
    js.append(f'tl.set("#cg{gi}", {{ opacity: 0, visibility: "hidden" }}, {T(g["end"])});')
js.append(f'tl.set({{}}, {{}}, {T(TOTAL)});')

# fromTo -> set + to so nothing shows before its cue
_ft = re.compile(r'^tl\.fromTo\("([^"]+)", (\{.*?\}), \{ (.*) \}, ([0-9.]+)\);$')
for k, l in enumerate(js):
    m = _ft.match(l)
    if m and float(m.group(4)) > 0:
        js[k] = f'tl.set("{m.group(1)}", {m.group(2)}, {m.group(4)}); tl.to("{m.group(1)}", {{ {m.group(3).replace("immediateRender: false, ", "").replace(", immediateRender: false", "")} }}, {m.group(4)});'

css = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#000; }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:#000; }}
#cam {{ position:absolute; inset:0; transform-origin:{FACE[0]}px {FACE[1]}px; will-change:transform, filter; }}
#cam video {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
#scrim {{ position:absolute; inset:0; opacity:0; background:radial-gradient(ellipse 80% 60% at 50% 45%, rgba(17,26,46,0.35), rgba(11,17,30,0.75)); }}
.top {{ position:absolute; left:0; right:0; top:290px; display:flex; flex-direction:column; align-items:center; gap:18px; }}
.pill, .chip {{ display:inline-flex; align-items:center; gap:16px; font-family:{CAPF}; font-weight:800; white-space:nowrap; opacity:0;
  box-shadow:0 14px 34px rgba(0,0,0,0.35); }}
.pill {{ font-size:44px; padding:18px 34px; border-radius:999px; }}
.pill i, .cta i, .areatag i, .achip i, .spk i {{ display:inline-flex; width:44px; height:44px; }}
.pill i svg, .cta i svg, .areatag i svg, .achip i svg, .spk i svg {{ width:100%; height:100%; }}
.pill.gold {{ background:{GOLD}; color:{NAVY}; }}
.pill.big {{ font-size:52px; padding:22px 40px; }}
.aring {{ position:absolute; left:50%; top:96px; width:820px; height:110px; margin-left:-410px; border-radius:999px; border:5px solid {GOLD}; opacity:0; }}
.pill.dark {{ background:rgba(17,26,46,0.92); color:#fff; border:2px solid rgba(255,255,255,0.12); }}
.pill i.g {{ color:{GOLD}; }}
.pill i.ok {{ color:{GREEN}; }}
.row {{ display:flex; gap:12px; opacity:0; }}
.chip {{ opacity:1; font-size:36px; padding:12px 26px; border-radius:999px; background:rgba(17,26,46,0.92); color:{GOLD}; letter-spacing:0.08em; }}
.toggle {{ position:relative; display:inline-block; width:84px; height:46px; border-radius:23px; background:rgba(255,255,255,0.25); margin-left:6px; }}
.knob {{ position:absolute; left:4px; top:4px; width:38px; height:38px; border-radius:50%; background:#fff; }}
.spks {{ display:flex; gap:22px; }}
.spk {{ position:relative; width:110px; height:110px; border-radius:28px; background:rgba(17,26,46,0.92); color:#C9D1E0; display:flex;
  align-items:center; justify-content:center; opacity:0; box-shadow:0 12px 28px rgba(0,0,0,0.35); }}
.spk i {{ width:62px; height:62px; }}
.spk.you {{ background:{GOLD}; color:{NAVY}; }}
.spk .cross {{ position:absolute; inset:14px; color:{RED}; opacity:0; }}
.spk .cross svg {{ width:100%; height:100%; }}
.cta {{ position:absolute; left:0; right:0; margin:0 auto; width:max-content; top:1170px; display:flex; white-space:nowrap; align-items:center; gap:16px; padding:18px 40px;
  border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:46px; letter-spacing:0.04em; opacity:0;
  box-shadow:0 16px 40px rgba(0,0,0,0.35); }}
.atitle {{ font-family:{CAPF}; font-weight:800; font-size:58px; color:#fff; opacity:0; text-shadow:0 4px 18px rgba(0,0,0,0.6); }}
.agrid {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }}
.phonewrap {{ position:absolute; left:0; right:0; top:236px; display:flex; flex-direction:column; align-items:center; opacity:0; }}
.ptag {{ position:relative; z-index:2; margin-bottom:-30px; padding:14px 34px; border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF};
  font-weight:800; font-size:42px; white-space:nowrap; opacity:0; box-shadow:0 14px 32px rgba(0,0,0,0.4); }}
.phone {{ width:640px; border-radius:46px; overflow:hidden; box-shadow:0 40px 90px rgba(0,0,0,0.6); }}
.phone img {{ display:block; width:100%; }}
.pill.lime {{ background:{GOLD}; color:{NAVY}; }}
.pill.plum {{ background:rgba(43,22,49,0.94); color:#fff; border:2px solid rgba(255,255,255,0.12); }}
.pill i.lm {{ color:{GOLD}; }}
.pill b {{ color:{GOLD}; }}
.stk {{ position:absolute; display:inline-flex; align-items:center; gap:12px; padding:16px 28px; border-radius:22px; font-family:{CAPF}; font-weight:800;
  font-size:40px; white-space:nowrap; opacity:0; box-shadow:0 16px 36px rgba(0,0,0,0.45); border:4px solid #fff; }}
.stk.lime {{ background:{GOLD}; color:{NAVY}; }}
.stk i {{ display:inline-flex; width:40px; height:40px; }}
.stk i svg {{ width:100%; height:100%; }}
.sorted {{ position:absolute; left:50%; top:420px; width:440px; margin-left:-220px; display:flex; flex-direction:column; align-items:center; opacity:0; }}
.sring {{ position:absolute; left:110px; top:0; width:220px; height:220px; border-radius:50%; border:8px solid {GOLD}; }}
.scheck {{ width:220px; height:220px; border-radius:50%; background:{GOLD}; color:{NAVY}; display:flex; align-items:center; justify-content:center;
  box-shadow:0 20px 50px rgba(0,0,0,0.45); }}
.scheck svg {{ width:130px; height:130px; }}
.stext {{ margin-top:18px; font-family:{CAPF}; font-weight:800; font-size:84px; color:#fff; letter-spacing:0.04em; text-shadow:0 6px 24px rgba(0,0,0,0.6); }}
.ftile {{ display:flex; align-items:center; gap:22px; padding:18px 40px; border-radius:30px; background:{GOLD}; color:{NAVY}; opacity:0;
  box-shadow:0 18px 40px rgba(0,0,0,0.4); }}
.fnum {{ font-family:{CAPF}; font-weight:800; font-size:130px; line-height:1; letter-spacing:-0.03em; min-width:150px; text-align:right; }}
.flab {{ font-family:{CAPF}; font-weight:800; font-size:38px; line-height:1.1; letter-spacing:0.04em; }}
.half {{ position:absolute; left:640px; top:560px; padding:14px 30px; border-radius:26px; background:#fff; color:{NAVY}; border:7px solid {NAVY};
  font-family:{CAPF}; font-weight:800; font-size:64px; line-height:0.95; text-align:center; opacity:0; box-shadow:0 18px 40px rgba(0,0,0,0.45); }}
.scard {{ display:flex; flex-direction:column; gap:12px; }}
.srow {{ display:flex; align-items:center; gap:18px; width:720px; padding:14px 22px; border-radius:24px; background:rgba(43,22,49,0.94); color:#fff;
  font-family:{CAPF}; font-weight:800; font-size:38px; opacity:0; box-shadow:0 12px 28px rgba(0,0,0,0.35); }}
.srow b {{ width:56px; height:56px; border-radius:50%; background:{GOLD}; color:{NAVY}; display:flex; align-items:center; justify-content:center; font-size:32px; }}
.stick {{ margin-left:auto; display:inline-flex; width:40px; height:40px; color:{GOLD}; opacity:0; }}
.stick svg {{ width:100%; height:100%; }}
#broll {{ position:absolute; inset:0; transform-origin:50% 45%; }}
#broll video {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
.cg.early {{ top:1215px; }}
.wanted {{ position:absolute; left:50%; top:1442px; width:700px; margin-left:-350px; height:112px; display:flex; align-items:center; justify-content:center;
  gap:16px; border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:46px; letter-spacing:0.04em;
  white-space:nowrap; opacity:0; box-shadow:0 16px 40px rgba(0,0,0,0.35); }}
.wanted i {{ display:inline-flex; width:46px; height:46px; }}
.wanted i svg {{ width:100%; height:100%; }}
.pill.gold {{ background:{GOLD}; color:{NAVY}; }}
.pill.dark {{ background:rgba(10,22,40,0.92); color:#fff; border:2px solid rgba(255,255,255,0.12); }}
.pill.gold b {{ color:{NAVY}; }}
.pill.sm {{ font-size:34px; padding:12px 26px; }}
.pill i.g {{ color:{GOLD}; }}
.row2 {{ display:flex; gap:12px; }}
.ctile {{ display:flex; align-items:center; gap:22px; padding:16px 40px; border-radius:30px; background:{GOLD}; color:{NAVY}; opacity:0;
  box-shadow:0 18px 40px rgba(0,0,0,0.4); }}
.cnum {{ font-family:{CAPF}; font-weight:800; font-size:130px; line-height:1; letter-spacing:-0.03em; min-width:150px; text-align:right; }}
.clab {{ font-family:{CAPF}; font-weight:800; font-size:38px; line-height:1.1; letter-spacing:0.04em; }}
.tgrid {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
.trow {{ display:flex; align-items:center; gap:12px; width:330px; padding:14px 22px; border-radius:22px; background:rgba(10,22,40,0.92); color:#fff;
  font-family:{CAPF}; font-weight:800; font-size:36px; opacity:0; box-shadow:0 10px 24px rgba(0,0,0,0.3); }}
.trow i {{ display:inline-flex; width:38px; height:38px; color:{GOLD}; }}
.trow i svg {{ width:100%; height:100%; }}
.btag {{ position:absolute; left:0; right:0; margin:0 auto; width:max-content; top:300px; display:flex; align-items:center; gap:14px; padding:16px 32px;
  border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:38px; opacity:0; white-space:nowrap;
  box-shadow:0 14px 32px rgba(0,0,0,0.45); }}
.btag i {{ display:inline-flex; width:40px; height:40px; }}
.btag i svg {{ width:100%; height:100%; }}
.price {{ position:absolute; left:620px; top:560px; padding:10px 34px; border-radius:26px; background:{GOLD}; color:{NAVY}; border:7px solid #fff;
  font-family:{CAPF}; font-weight:800; font-size:110px; letter-spacing:-0.02em; opacity:0; box-shadow:0 18px 40px rgba(0,0,0,0.45); }}
.cg {{ position:absolute; left:70px; right:70px; top:1335px; height:190px; display:flex; flex-wrap:wrap; justify-content:center; align-content:center;
  gap:0 24px; opacity:0; }}
.cw {{ display:inline-block; font-family:{CAPF}; font-weight:800; font-size:76px; line-height:1.12; color:#fff; letter-spacing:-0.01em; opacity:0;
  -webkit-text-stroke:3px rgba(0,0,0,0.85); paint-order:stroke fill; text-shadow:0 5px 0 rgba(0,0,0,0.55), 0 8px 26px rgba(0,0,0,0.55); will-change:transform; }}
.cw.key {{ color:{GOLD}; }}
"""

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Claude workshop recap</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{T(TOTAL)}">
      <div id="cam">
{chr(10).join('        ' + c for c in clips if 'broll' not in c)}
      </div>
      <div id="broll">
{chr(10).join('        ' + c for c in clips if 'broll' in c)}
      </div>
      <div id="scrim"></div>
{chr(10).join('      ' + o for o in over)}
{chr(10).join('      ' + c for c in cb)}
    </div>
    <script>
      function countUp(sel, target) {{
        const el = document.querySelector(sel);
        el.textContent = Math.round(target * this.progress());
      }}
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join('      ' + l for l in js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
json.dump(dict(total=TOTAL, segments=segs, sfx=SFX), open("timeline.json", "w"), indent=1)
print(f"total {TOTAL}s, {len(segs)} segments, {len(CAP)} caption groups")
for g in CAP:
    print(f"  {g['start']:6.2f}-{g['end']:6.2f}  " + " ".join(("[" + w['text'] + "]") if i in g['keys'] else w['text'] for i, w in enumerate(g['words'])))

# ------------------------------------------------------------------ SRT + plain transcript (edited cut)
def stamp(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s_:02d},{ms:03d}"
srt = []
for k, g in enumerate(CAP):
    srt.append(f"{k + 1}\n{stamp(g['start'])} --> {stamp(g['end'])}\n{' '.join(w['text'] for w in g['words'])}\n")
open("captions.srt", "w").write("\n".join(srt))
lines = [" ".join(w["text"] for w in words if w["seg"] == k) for k in range(len(segs))]
open("transcript.txt", "w").write("\n".join(lines) + "\n")
