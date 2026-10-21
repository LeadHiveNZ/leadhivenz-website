#!/usr/bin/env python3
"""Website build ad: tight talking-head cut + captions + result mock-ups + motion graphics.

Inputs: edl.json (kept source ranges, D = audio blend), transcript.json (Parakeet words),
assets/source.mp4 (graded-free H.264 copy of the upload, Videoleap watermark delogo'd 0.1-3.25 s),
assets/voice.m4a (voice cut to the same EDL, noise-only cleanup). Writes index.html + timeline.json.
"""
import json, html, re

W, H = 1080, 1920
NAVY, NAVY2, GOLD, CREAM, INK = "#111A2E", "#18233B", "#F5B335", "#F4F1EA", "#0B111E"
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
        seg = next((k for k, sg in enumerate(segs) if sg["src_in"] - 0.25 <= st <= sg["src_out"] + tol), None)
    if seg is None:
        continue
    if txt == "Builders" and raw[i + 1]["text"].startswith("Crack"):
        txt, skip = "Builderscrack,", True
    elif txt.startswith("understand"):
        txt, skip = "undercut", True
    txt = {"inquiries": "enquiries"}.get(txt, txt)
    st = max(st, segs[seg]["src_in"] + 0.03)
    words.append(dict(text=txt, start=to_out(min(st, segs[seg]["src_out"] - 0.05)), seg=seg))
for w in words:                       # the cut false start sat between these two words
    if w["seg"] == 0 and w["text"] == "bucks": w["text"] = "bucks."
    if w["seg"] == 1 and w["text"] == "most": w["text"] = "Most"
for k in range(1, len(words)):
    if words[k]["start"] < words[k - 1]["start"] + 0.07:
        words[k]["start"] = round(words[k - 1]["start"] + 0.07, 3)
def word_t(text, seg, nth=0):
    hits = [w["start"] for w in words if w["seg"] == seg and w["text"].lower().strip(",.") == text.lower()]
    return hits[nth]

# ------------------------------------------------------------------ captions (2-3 words, key word gold)
KEY = set("""websites 500 agencies grand google reviews business profile enquiries customers work ads money table
demo yours away christchurch tradie link name number free 24 hours""".split())
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
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("if", 3))});')            # beats inside the long lines
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("you", 4))});')
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("even", 4))});')
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("pop", 8))});')

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
    "play": '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    "search": '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    "star": '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>',
    "mail": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    "img": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
})

# ------------------------------------------------------------------ hook framing + cover banner over the removed watermark
s0 = segs[0]
js.append(f'tl.set("#cam", {{ scale: 1.15, y: 120 }}, 0);')                 # face eases lower so the sites sit above it
js.append(f'tl.set("#cam", {{ scale: 1.0, y: 0 }}, {T(segs[1]["out_in"])});')
WM_END = to_out(3.25) + 0.1
over.append(f'<div class="wanted" id="wanted">WEBSITES FROM $500</div>')
js.append(f'tl.fromTo("#wanted", {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }}, 0.001);')
js.append(f'tl.to("#wanted", {{ opacity: 0, y: 40, duration: 0.2, ease: "power2.in" }}, {T(WM_END)});')

# ------------------------------------------------------------------ 1. three $500 sites fly in at the top
SITES = [("site1.jpg", "contenthiveau.com", 290, 452, -8, "these"), ("site2.jpg", "poriruahardscapes.co.nz", 790, 452, 8, "three"),
         ("site3.jpg", "aroha-seniors.nz", 540, 432, 0, "websites")]
cards = ""
for k, (img, url, cx, cy, rot, wd) in enumerate(SITES):
    w = 600 if k == 2 else 500
    cards += (f'<div class="site" id="site{k}" style="left:{cx - w // 2}px; top:{cy - int(w * 0.5625) // 2 - 22}px; width:{w}px;">'
              f'<div class="sbar"><i></i><i></i><i></i><span>{url}</span></div><img src="assets/sites/{img}" alt="" /></div>')
over.append(f'<div id="sites">{cards}<div class="stamp5" id="stamp5">$500</div></div>')
for k, (img, url, cx, cy, rot, wd) in enumerate(SITES):
    t = word_t(wd, 0)
    js.append(f'tl.fromTo("#site{k}", {{ opacity: 0, y: -260, rotation: {rot * 3}, scale: 0.7 }}, {{ opacity: 1, y: 0, rotation: {rot}, scale: 1, duration: 0.36, ease: "back.out(1.6)" }}, {T(t - 0.08)});')
t500 = word_t("500", 0)
js.append(f'tl.fromTo("#stamp5", {{ opacity: 0, scale: 2.6, rotation: -25 }}, {{ opacity: 1, scale: 1, rotation: -10, duration: 0.2, ease: "power4.in" }}, {T(t500 - 0.06)});')
js.append(f'tl.to("#sites", {{ opacity: 0, y: -40, scale: 0.92, duration: 0.2, ease: "power2.in" }}, {T(s0["out_out"] - 0.12)});')

# ------------------------------------------------------------------ 2. $5,000 vs $500 (segs 1-2)
over.append(f'<div class="top" id="price"><div class="prow">'
            f'<div class="ptile" id="pt1"><div class="plab">MOST AGENCIES</div><div class="pnum red">$5,000<b class="strike" id="strike"></b></div></div>'
            f'<div class="ptile gold" id="pt2"><div class="plab">ME</div><div class="pnum">$500</div></div></div></div>')
show("#pt1", word_t("agencies", 1) - 0.05, segs[2]["out_out"] + 0.15)
js.append(f'tl.fromTo("#pt1 .pnum", {{ scale: 1.25 }}, {{ scale: 1, duration: 0.3, ease: "back.out(3)" }}, {T(word_t("five", 1) - 0.05)});')
show("#pt2", word_t("500", 2) - 0.08, segs[2]["out_out"] + 0.15, frm="{ opacity: 0, y: 40, scale: 0.5 }", ease="back.out(2.4)")
js.append(f'tl.fromTo("#strike", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.22, ease: "power2.out" }}, {T(word_t("500", 2) + 0.05)});')
js.append(f'tl.to("#pt1", {{ opacity: 0.55, scale: 0.92, duration: 0.25 }}, {T(word_t("500", 2) + 0.1)});')

# ------------------------------------------------------------------ 3. demo offer (seg 3)
s3 = segs[3]
over.append(f'<div class="top" id="steps"><div class="pill gold" id="st1"><i>{ICON["play"]}</i>Live demo first</div>'
            f'<div class="pill dark" id="st2"><i class="ok">{ICON["check"]}</i>Like it? It\'s yours</div>'
            f'<div class="pill dark" id="st3"><i class="g">{ICON["arrow"]}</i>Don\'t? Walk away</div></div>')
show("#st1", word_t("live", 3) - 0.05, s3["out_out"] + 0.1)
show("#st2", word_t("like", 3) - 0.05, s3["out_out"] + 0.1)
show("#st3", word_t("walk", 3) - 0.2, s3["out_out"] + 0.1)

# ------------------------------------------------------------------ 4. shows up on Google (seg 4)
s4 = segs[4]
t_g, t_rev = word_t("google", 4), word_t("reviews", 4)
query = "builder near me"
qchars = "".join(f'<span class="qc" id="qc{k}">{esc(ch) if ch != " " else "&nbsp;"}</span>' for k, ch in enumerate(query))
stars = "".join(f'<i class="st" id="gst{k}">{ICON["star"]}</i>' for k in range(5))
over.append(f'<div class="top" id="goo"><div class="sbox" id="sbox"><i>{ICON["search"]}</i><span class="q">{qchars}</span></div>'
            f'<div class="gres" id="gres"><div class="gr1"><b>#1</b> Your Business</div><div class="gr2">{stars}<span>5.0</span></div></div>'
            f'<div class="chips"><span class="gchip" id="gc1"><i>{ICON["pin"]}</i>Business Profile</span>'
            f'<span class="gchip" id="gc2"><i>{ICON["mail"]}</i>Web enquiries</span><span class="gchip" id="gc3"><i>{ICON["img"]}</i>Show your work</span></div></div>')
show("#sbox", word_t("shows", 4) - 0.05, s4["out_out"] + 0.1)
for k in range(len(query)):
    js.append(f'tl.set("#qc{k}", {{ opacity: 1 }}, {T(word_t("shows", 4) + 0.15 + k * 0.035)});')
show("#gres", t_g - 0.02, s4["out_out"] + 0.1, frm="{ opacity: 0, y: -16, scale: 0.96 }")
for k in range(5):
    js.append(f'tl.fromTo("#gst{k}", {{ opacity: 0.25, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.15, ease: "back.out(3)" }}, {T(t_rev + 0.05 * k)});')
show("#gc1", word_t("business", 4) - 0.05, s4["out_out"] + 0.1)
show("#gc2", word_t("enquiries", 4) - 0.05, s4["out_out"] + 0.1)
show("#gc3", word_t("work.", 4, 0) - 0.3 if False else word_t("customers", 4) - 0.05, s4["out_out"] + 0.1)

# ------------------------------------------------------------------ 5. Google Ads (seg 5)
s5 = segs[5]
over.append(f'<div class="top" id="ads"><div class="pill dark" id="ad1"><span class="adb">Ad</span>The landing page your ads need</div></div>')
show("#ad1", word_t("tool", 5) - 0.05, s5["out_out"] + 0.1)

# ------------------------------------------------------------------ 6. money on the table (seg 6)
s6 = segs[6]
t_money = word_t("money", 6)
import random as _r
_rr = _r.Random(500)
NOTE = ('<svg viewBox="0 0 120 64"><rect x="2" y="2" width="116" height="60" rx="8" fill="#2FB36B" stroke="#1E7A45" stroke-width="4"/>'
        '<circle cx="60" cy="32" r="15" fill="none" stroke="#DDF3E5" stroke-width="5"/><circle cx="18" cy="32" r="5" fill="#DDF3E5"/><circle cx="102" cy="32" r="5" fill="#DDF3E5"/></svg>')
cash = "".join(f'<span class="cash" id="cash{k}" style="left:{_rr.randint(40, 960)}px;">{NOTE}</span>' for k in range(16))
over.append(f'<div id="cashwrap">{cash}</div><div class="top" id="money"><div class="pill gold big" id="mo1">Leaving money on the table</div></div>')
show("#mo1", t_money - 0.1, s6["out_out"] + 0.1, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.4)")
for k in range(16):
    t0 = t_money - 0.2 + _rr.uniform(0, 0.9)
    js.append(f'tl.fromTo("#cash{k}", {{ opacity: 0, y: -120, rotation: {_rr.randint(-40, 40)} }}, {{ opacity: 1, y: 40, rotation: {_rr.randint(-20, 20)}, duration: 0.25, ease: "power1.out" }}, {T(t0)});')
    js.append(f'tl.to("#cash{k}", {{ y: {_rr.randint(420, 620)}, opacity: 0, rotation: {_rr.randint(-180, 180)}, duration: {_rr.uniform(0.9, 1.4):.2f}, ease: "power1.in" }}, {T(t0 + 0.25)});')

# ------------------------------------------------------------------ 7. Christchurch site B-roll (laptop insert from the source, 47.0-49.6)
s7 = segs[7]
B_IN = word_t("one", 7) - 0.05
B_DUR = 2.4
clips.append(f'<video id="vins" class="clip broll" src="assets/source.mp4" muted playsinline data-start="{T(B_IN)}" data-duration="{T(B_DUR)}" data-media-start="47.10" data-track-index="1"></video>')
over.append(f'<div class="cttag" id="cttag"><i>{ICON["pin"]}</i>Built for a Christchurch tradie</div>')
show("#cttag", B_IN + 0.15, B_IN + B_DUR)

# ------------------------------------------------------------------ 8. CTA: link, form, free in 24 hours (seg 8)
s8 = segs[8]
over.append(f'<div class="cta" id="cta"><i>{ICON["down"]}</i>LINK BELOW</div>')
show("#cta", max(word_t("tap", 8), B_IN + B_DUR) - 0.05, TOTAL + 0.2)
js.append(f'tl.to("#cta i", {{ y: 10, duration: 0.3, repeat: 5, yoyo: true, ease: "sine.inOut" }}, {T(max(word_t("tap", 8), B_IN + B_DUR) + 0.2)});')
fields = [("Name", "name,"), ("Number", "number,"), ("Business", "business,")]
rows = "".join(f'<div class="frow" id="fr{k}"><span>{n}</span><b class="fline"><b class="ffill" id="ff{k}"></b></b><i class="ftick" id="ft{k}">{ICON["check"]}</i></div>' for k, (n, w) in enumerate(fields))
over.append(f'<div class="top" id="form"><div class="fcard" id="fcard">{rows}</div><div class="pill gold big" id="free"><i>{ICON["check"]}</i>FREE · within 24 hours</div></div>')
show("#fcard", word_t("pop", 8) - 0.1, TOTAL + 0.2)
for k, (n, w) in enumerate(fields):
    t = word_t(w.strip(","), 8)
    js.append(f'tl.fromTo("#ff{k}", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.3, ease: "power2.out" }}, {T(t - 0.05)});')
    js.append(f'tl.fromTo("#ft{k}", {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.2, ease: "back.out(3)" }}, {T(t + 0.22)});')
show("#free", word_t("free", 8) - 0.08, TOTAL + 0.2, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.4)")

SFX = [dict(t=word_t(w, 0) - 0.14) for w in ("these", "three", "websites")] + [dict(t=B_IN - 0.12)]

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
.achip {{ display:flex; align-items:center; gap:12px; padding:14px 22px; border-radius:22px; background:rgba(17,26,46,0.92); color:#fff;
  font-family:{CAPF}; font-weight:800; font-size:34px; opacity:0; box-shadow:0 10px 24px rgba(0,0,0,0.3); }}
.achip i {{ width:36px; height:36px; color:{RED}; }}
.achip span {{ margin-left:auto; padding-left:14px; font-size:22px; letter-spacing:0.1em; color:rgba(255,255,255,0.55); }}
.achip.open {{ background:{GOLD}; color:{NAVY}; }}
.achip.open i {{ color:{NAVY}; }}
.achip.open span {{ color:{NAVY}; }}
.phonewrap {{ position:absolute; left:0; right:0; top:250px; display:flex; flex-direction:column; align-items:center; opacity:0; }}
.areatag {{ position:relative; z-index:2; margin-bottom:-34px; display:inline-flex; align-items:center; gap:14px; padding:16px 34px; border-radius:999px;
  background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:46px; letter-spacing:0.06em; opacity:0; box-shadow:0 14px 32px rgba(0,0,0,0.4); }}
.phone {{ width:720px; height:1030px; border-radius:76px; background:#05070C; padding:16px; box-shadow:0 40px 90px rgba(0,0,0,0.55), 0 0 0 3px rgba(255,255,255,0.08); }}
.screen {{ position:relative; width:100%; height:100%; border-radius:62px; overflow:hidden; background:#F2F4F7; font-family:{UI}; }}
.apphead {{ height:178px; background:{NAVY}; display:flex; align-items:flex-end; gap:26px; padding:0 40px 34px; color:#fff; }}
.chev {{ width:18px; height:18px; border-left:4px solid #fff; border-bottom:4px solid #fff; transform:rotate(45deg); margin-bottom:22px; }}
.ah1 {{ font-size:38px; font-weight:700; }}
.ah2 {{ font-size:27px; color:rgba(255,255,255,0.72); margin-top:4px; }}
.hero {{ position:relative; margin:26px 26px 0; border-radius:40px; background:{NAVY}; color:#fff; padding:34px 36px 32px; overflow:hidden; }}
.hex {{ position:absolute; inset:0; opacity:0.13; background-image:
  linear-gradient(30deg, transparent 47%, #fff 48%, #fff 52%, transparent 53%), linear-gradient(150deg, transparent 47%, #fff 48%, #fff 52%, transparent 53%),
  linear-gradient(90deg, transparent 48%, #fff 49%, #fff 51%, transparent 52%); background-size:70px 120px; }}
.glow {{ position:absolute; right:-80px; top:-80px; width:360px; height:360px; border-radius:50%; background:radial-gradient(circle, rgba(245,179,53,0.35), transparent 70%); }}
.hmonth {{ position:relative; font-size:26px; font-weight:700; letter-spacing:0.06em; color:rgba(255,255,255,0.85); }}
.hnum {{ position:relative; display:flex; align-items:baseline; gap:12px; margin-top:6px; }}
.hnum span {{ font-size:148px; font-weight:800; line-height:1; letter-spacing:-0.04em; }}
.hnum small {{ font-size:44px; font-weight:600; }}
.hplan {{ position:relative; font-size:28px; color:rgba(255,255,255,0.85); margin-top:8px; }}
.hpills {{ position:relative; display:flex; gap:12px; margin-top:22px; flex-wrap:wrap; }}
.ppill {{ display:inline-flex; align-items:center; gap:10px; font-size:25px; font-weight:700; padding:10px 20px; border-radius:999px; background:rgba(255,255,255,0.12); }}
.ppill.ok {{ background:#DDF3E5; color:#1E7A45; }}
.ppill b {{ width:13px; height:13px; border-radius:50%; background:{GREEN}; display:block; }}
.slist {{ margin:24px 26px 0; border-radius:34px; background:#fff; border:2px solid #E3E7EE; padding:6px 32px; }}
.srow {{ display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:2px solid #EEF1F5; font-size:29px; color:#1B2335; }}
.srow:last-child {{ border-bottom:0; }}
.srow strong {{ font-weight:800; }}
.srow em {{ font-style:normal; font-weight:600; color:#7A8496; }}
.tauextra {{ position:relative; margin:30px 40px 0; }}
.bar {{ position:relative; height:22px; border-radius:11px; background:#DCE1EA; }}
.bar .fill {{ position:absolute; inset:0; border-radius:11px; background:{GREEN}; transform-origin:0 50%; }}
.bar .tick {{ position:absolute; left:60%; top:-10px; width:6px; height:42px; border-radius:3px; background:{NAVY}; }}
.barlab {{ display:flex; justify-content:space-between; margin-top:14px; font-size:25px; color:#5B6578; font-weight:600; }}
.stamp {{ margin:34px auto 0; width:max-content; padding:14px 40px; border:7px solid {GOLD}; border-radius:22px; color:{GOLD}; font-family:{CAPF};
  font-weight:800; font-size:62px; letter-spacing:0.06em; opacity:0; background:rgba(245,179,53,0.08); }}
.stamp b {{ font-size:78px; }}
.tnote {{ margin-top:22px; text-align:center; font-size:31px; line-height:1.35; color:#1B2335; font-weight:600; opacity:0; }}
.tnote b {{ color:{NAVY}; font-weight:800; }}
.cg {{ position:absolute; left:70px; right:70px; top:1335px; height:190px; display:flex; flex-wrap:wrap; justify-content:center; align-content:center;
  gap:0 24px; opacity:0; }}
.cw {{ display:inline-block; font-family:{CAPF}; font-weight:800; font-size:76px; line-height:1.12; color:#fff; letter-spacing:-0.01em; opacity:0;
  -webkit-text-stroke:3px rgba(0,0,0,0.85); paint-order:stroke fill; text-shadow:0 5px 0 rgba(0,0,0,0.55), 0 8px 26px rgba(0,0,0,0.55); will-change:transform; }}
.cw.key {{ color:{GOLD}; }}
.cg.early {{ top:1335px; }}
#broll {{ position:absolute; inset:0; }}
#broll video {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
#sites {{ position:absolute; inset:0; }}
.site {{ position:absolute; border-radius:22px; overflow:hidden; background:#0B111E; opacity:0; box-shadow:0 24px 60px rgba(0,0,0,0.45), 0 0 0 3px rgba(255,255,255,0.12); }}
.sbar {{ height:44px; display:flex; align-items:center; gap:9px; padding:0 16px; background:#1B2335; }}
.sbar i {{ width:13px; height:13px; border-radius:50%; background:#E5484D; display:block; }}
.sbar i:nth-child(2) {{ background:#F5B335; }}
.sbar i:nth-child(3) {{ background:#2FB36B; }}
.sbar span {{ margin-left:12px; padding:4px 14px; border-radius:999px; background:rgba(255,255,255,0.1); color:#C9D1E0; font-family:{UI}; font-size:20px; white-space:nowrap; }}
.site img {{ display:block; width:100%; }}
.stamp5 {{ position:absolute; left:640px; top:600px; padding:10px 34px; border-radius:24px; background:{GOLD}; color:{NAVY}; font-family:{CAPF};
  font-weight:800; font-size:96px; letter-spacing:-0.02em; opacity:0; box-shadow:0 18px 40px rgba(0,0,0,0.45); border:6px solid #fff; }}
.prow {{ display:flex; gap:24px; }}
.ptile {{ display:flex; flex-direction:column; align-items:center; padding:18px 34px 22px; border-radius:30px; background:rgba(17,26,46,0.94);
  color:#fff; opacity:0; box-shadow:0 18px 40px rgba(0,0,0,0.4); }}
.ptile.gold {{ background:{GOLD}; color:{NAVY}; }}
.plab {{ font-family:{CAPF}; font-weight:800; font-size:28px; letter-spacing:0.12em; opacity:0.85; }}
.pnum {{ position:relative; font-family:{CAPF}; font-weight:800; font-size:96px; line-height:1.05; letter-spacing:-0.02em; }}
.pnum.red {{ color:#FF6B6B; }}
.strike {{ position:absolute; left:-6px; right:-6px; top:50%; height:10px; margin-top:-5px; border-radius:5px; background:#fff; transform-origin:0 50%; display:block; }}
.sbox {{ display:flex; align-items:center; gap:18px; width:780px; height:92px; padding:0 30px; border-radius:46px; background:#fff; color:#1B2335;
  font-family:{UI}; font-size:40px; opacity:0; box-shadow:0 14px 34px rgba(0,0,0,0.35); }}
.sbox i {{ display:inline-flex; width:42px; height:42px; color:#5B6578; }}
.sbox i svg {{ width:100%; height:100%; }}
.qc {{ opacity:0; }}
.gres {{ width:780px; padding:16px 30px; border-radius:26px; background:rgba(17,26,46,0.94); color:#fff; font-family:{CAPF}; opacity:0;
  box-shadow:0 14px 34px rgba(0,0,0,0.35); }}
.gr1 {{ font-weight:800; font-size:40px; }}
.gr1 b {{ color:{GOLD}; margin-right:8px; }}
.gr2 {{ display:flex; align-items:center; gap:6px; margin-top:6px; color:{GOLD}; font-weight:800; font-size:30px; }}
.gr2 .st {{ display:inline-flex; width:34px; height:34px; }}
.gr2 .st svg {{ width:100%; height:100%; }}
.gr2 span {{ margin-left:10px; color:#fff; }}
.chips {{ display:flex; flex-wrap:wrap; justify-content:center; gap:12px; width:900px; }}
.gchip {{ display:inline-flex; align-items:center; gap:10px; padding:12px 22px; border-radius:999px; background:{GOLD}; color:{NAVY};
  font-family:{CAPF}; font-weight:800; font-size:32px; opacity:0; box-shadow:0 10px 24px rgba(0,0,0,0.3); }}
.gchip i {{ display:inline-flex; width:32px; height:32px; }}
.gchip i svg {{ width:100%; height:100%; }}
.adb {{ padding:4px 14px; border-radius:10px; background:{GOLD}; color:{NAVY}; font-size:32px; margin-right:4px; }}
#cashwrap {{ position:absolute; left:0; right:0; top:240px; height:700px; overflow:hidden; }}
.cash {{ position:absolute; top:0; width:110px; height:59px; opacity:0; filter:drop-shadow(0 6px 12px rgba(0,0,0,0.4)); }}
.cash svg {{ width:100%; height:100%; display:block; }}
.cttag {{ position:absolute; left:0; right:0; margin:0 auto; width:max-content; top:300px; display:flex; align-items:center; gap:14px; padding:16px 34px;
  border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:44px; opacity:0; white-space:nowrap;
  box-shadow:0 14px 32px rgba(0,0,0,0.4); }}
.cttag i {{ display:inline-flex; width:44px; height:44px; }}
.cttag i svg {{ width:100%; height:100%; }}
.fcard {{ width:760px; padding:20px 30px; border-radius:30px; background:#fff; opacity:0; box-shadow:0 18px 40px rgba(0,0,0,0.4); }}
.frow {{ display:flex; align-items:center; gap:20px; height:62px; font-family:{CAPF}; font-weight:800; font-size:32px; color:#1B2335; }}
.frow span {{ width:170px; }}
.fline {{ position:relative; flex:1; height:16px; border-radius:8px; background:#E3E7EE; overflow:hidden; display:block; }}
.ffill {{ position:absolute; inset:0; background:{NAVY}; transform-origin:0 50%; border-radius:8px; display:block; }}
.ftick {{ display:inline-flex; width:40px; height:40px; color:#2FB36B; opacity:0; }}
.ftick svg {{ width:100%; height:100%; }}

.wanted {{ position:absolute; left:50%; top:1652px; width:660px; margin-left:-330px; height:112px; display:flex; align-items:center; justify-content:center;
  gap:16px; border-radius:999px; background:{GOLD}; color:{NAVY}; font-family:{CAPF}; font-weight:800; font-size:46px; letter-spacing:0.04em;
  white-space:nowrap; opacity:0; box-shadow:0 16px 40px rgba(0,0,0,0.35); }}
.wanted i {{ display:inline-flex; width:46px; height:46px; }}
.wanted i svg {{ width:100%; height:100%; }}
"""

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Website build ad</title>
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
json.dump(dict(total=TOTAL, segments=segs, broll=[B_IN, B_IN + B_DUR], sfx=[s["t"] for s in SFX]), open("timeline.json", "w"), indent=1)
print(f"total {TOTAL}s, {len(segs)} segments, {len(CAP)} caption groups, b-roll {B_IN:.2f}-{B_IN + B_DUR:.2f}")
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
