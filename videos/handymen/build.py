#!/usr/bin/env python3
"""Handymen recruitment video: tight talking-head cut + captions + result mock-ups + motion graphics.

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
for k in range(1, len(words)):
    if words[k]["start"] < words[k - 1]["start"] + 0.07:
        words[k]["start"] = round(words[k - 1]["start"] + 0.07, 3)
def word_t(text, seg, nth=0):
    hits = [w["start"] for w in words if w["seg"] == seg and w["text"].lower().strip(",.") == text.lower()]
    return hits[nth]

# ------------------------------------------------------------------ captions (2-3 words, key word gold)
KEY = set("""handyman region zealand residential maintenance qualified enquiries auckland wellington builderscrack race bottom
undercutting straight same-day attention 18 tradesmen country model area available link form call""".split())
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
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("each", 0))});')          # beat inside the long opener
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("residential", 0))});')
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("click", 7))});')

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

# ------------------------------------------------------------------ 1. hook: one handyman, each region
s0 = segs[0]
t_one, t_each, t_res = word_t("one", 0), word_t("each", 0), word_t("residential", 0)
over.append(f'<div class="top" id="hook"><div class="pill gold" id="hook-a"><i>{ICON["home"]}</i>1 HANDYMAN</div>'
            f'<div class="row" id="hook-b"><span class="chip" id="hc0">PER REGION</span></div>'
            f'<div class="pill dark" id="hook-c"><i class="g">{ICON["bolt"]}</i>Residential maintenance</div></div>')
show("#hook-a", t_one - 0.05, s0["out_out"])
show("#hook-b", t_each - 0.05, s0["out_out"])
show("#hook-c", t_res - 0.05, s0["out_out"])

# opening banner sits over the band where the Videoleap watermark was removed (source 0.1-3.25 s)
WM_END = to_out(3.25) + 0.1
over.append(f'<div class="wanted" id="wanted"><i>{ICON["home"]}</i>HANDYMEN WANTED</div>')
js.append(f'tl.fromTo("#wanted", {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }}, 0.001);')
js.append(f'tl.to("#wanted", {{ scale: 1.04, duration: 0.4, repeat: 3, yoyo: true, ease: "sine.inOut" }}, 0.3);')
js.append(f'tl.to("#wanted", {{ opacity: 0, y: 40, duration: 0.2, ease: "power2.in" }}, {T(WM_END)});')

# ------------------------------------------------------------------ 2. result phones (full-screen B-roll), from Joe's screenshots
RES = [
    dict(cid="akl", seg=1, side=1, area="AUCKLAND", word="Auckland", biz="Crestmark Construction", head="August 2026 report",
         month="AUGUST 2026", leads=33, pills=[("Above target", True)],
         rows=[("Phone calls", "20"), ("Answered", "20 <em>(100%)</em>"), ("Web enquiries", "13"), ("Average call length", "2m 13s"), ("Estimated value of leads", "$14,850")]),
    dict(cid="sak", seg=2, side=-1, area="SOUTH AUCKLAND", word="South", biz="RNZ Renovation", head="September 2026 report",
         month="SEPTEMBER 2026", leads=25, pills=[("On target", True), ("+2 leads vs Aug 2026", False)],
         rows=[("Phone calls", "21"), ("Answered", "18 <em>(86%)</em>"), ("Web enquiries", "4"), ("Average call length", "1m 27s"), ("Estimated value of leads", "$11,250")]),
    dict(cid="wlg", seg=3, side=1, area="WELLINGTON", word="Wellington", biz="K Build", head="September 2026 report",
         month="SEPTEMBER 2026", leads=40, pills=[("Above target", True)],
         rows=[("Phone calls", "30"), ("Answered", "25 <em>(83%)</em>"), ("Web enquiries", "10"), ("Average call length", "1m 48s"), ("Estimated value of leads", "$18,000")]),
]
BROLL_IN = segs[1]["out_in"]
BROLL_OUT = round(segs[4]["out_in"] + 1.1, 3)
js.append(f'tl.to("#cam", {{ filter: "blur(22px) brightness(0.5)", duration: 0.22, ease: "power2.out" }}, {T(BROLL_IN - 0.05)});')
js.append(f'tl.to("#cam", {{ filter: "blur(0px) brightness(1)", duration: 0.25, ease: "power2.out" }}, {T(BROLL_OUT - 0.1)});')
js.append(f'tl.fromTo("#scrim", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.22 }}, {T(BROLL_IN - 0.05)});')
js.append(f'tl.to("#scrim", {{ opacity: 0, duration: 0.25 }}, {T(BROLL_OUT - 0.1)});')
for k, r in enumerate(RES):
    sg = segs[r["seg"]]
    t_in = sg["out_in"] - 0.04
    t_out = BROLL_OUT if k == len(RES) - 1 else segs[r["seg"] + 1]["out_in"]
    t_area = word_t(r["word"], r["seg"])
    pills = "".join(f'<span class="ppill{" ok" if ok else ""}">{"<b></b>" if ok else ""}{esc(p)}</span>' for p, ok in r["pills"])
    body = "".join(f'<div class="srow" id="{r["cid"]}-r{j}"><span>{esc(a)}</span><strong>{b}</strong></div>' for j, (a, b) in enumerate(r["rows"]))
    over.append(f'<div class="phonewrap" id="{r["cid"]}">'
                f'<div class="areatag" id="{r["cid"]}-tag"><i>{ICON["pin"]}</i>{r["area"]}</div>'
                f'<div class="phone"><div class="screen">'
                f'<div class="apphead"><span class="chev"></span><div><div class="ah1">{r["head"]}</div><div class="ah2">{esc(r["biz"])}</div></div></div>'
                f'<div class="hero"><div class="hex"></div><div class="glow"></div>'
                f'<div class="hmonth">{r["month"]}</div>'
                f'<div class="hnum"><span id="{r["cid"]}-n">0</span><small>leads</small></div>'
                f'<div class="hplan">Starter plan &middot; target 15 to 25</div>'
                f'<div class="hpills">{pills}</div></div>'
                f'<div class="slist">{body}</div></div></div></div>')
    dx = 1100 * r["side"]
    js.append(f'tl.fromTo("#{r["cid"]}", {{ x: {dx}, opacity: 1, rotation: {4 * r["side"]} }}, {{ x: 0, rotation: 0, duration: 0.3, ease: "power3.out" }}, {T(t_in)});')
    if k < len(RES) - 1:
        js.append(f'tl.to("#{r["cid"]}", {{ x: {-1100 * RES[k + 1]["side"]}, rotation: {-4 * RES[k + 1]["side"]}, duration: 0.26, ease: "power3.in" }}, {T(t_out - 0.26)});')
    else:
        js.append(f'tl.to("#{r["cid"]}", {{ opacity: 0, scale: 0.94, duration: 0.25, ease: "power2.in" }}, {T(t_out - 0.25)});')
    js.append(f'tl.set("#{r["cid"]}", {{ visibility: "hidden" }}, {T(t_out)});')
    js.append(f'tl.fromTo("#{r["cid"]}-tag", {{ opacity: 0, scale: 0.4, y: 20 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.28, ease: "back.out(2.6)" }}, {T(min(t_area - 0.04, t_in + 0.3))});')
    js.append(f'tl.to("#{r["cid"]}-n", {{ duration: 0.7, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#{r["cid"]}-n", {r["leads"]}] }}, {T(t_in + 0.15)});')
    for j in range(len(r["rows"])):
        js.append(f'tl.fromTo("#{r["cid"]}-r{j}", {{ opacity: 0, x: {30 * r["side"]} }}, {{ opacity: 1, x: 0, duration: 0.16, ease: "power2.out" }}, {T(t_in + 0.12 + 0.04 * j)});')

# ------------------------------------------------------------------ 3. no race to the bottom (seg 4)
s4 = segs[4]
t_race, t_under = word_t("race", 4), word_t("undercutting", 4)
icons = "".join(f'<div class="spk{" you" if j == 2 else ""}" id="spk{j}"><i>{ICON["user"]}</i><span class="cross">{ICON["x"]}</span></div>' for j in range(5))
over.append(f'<div class="top" id="bid"><div class="spks">{icons}</div><div class="pill dark" id="bid-l"><i class="g">{ICON["bolt"]}</i>No race to the bottom. Just you.</div></div>')
for j in range(5):
    js.append(f'tl.fromTo("#spk{j}", {{ opacity: 0, y: 30, scale: 0.6 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "back.out(2)" }}, {T(max(BROLL_OUT, t_race - 0.1) + 0.06 * j)});')
    if j != 2:
        js.append(f'tl.fromTo("#spk{j} .cross", {{ opacity: 0, scale: 2 }}, {{ opacity: 1, scale: 1, duration: 0.18, ease: "power3.in" }}, {T(t_under - 0.1 + 0.05 * j)});')
        js.append(f'tl.to("#spk{j}", {{ opacity: 0.35, duration: 0.2 }}, {T(t_under + 0.1 + 0.05 * j)});')
js.append(f'tl.to("#spk2", {{ scale: 1.25, duration: 0.25, ease: "back.out(3)" }}, {T(t_under + 0.15)});')
show("#bid-l", t_under + 0.2, s4["out_out"] + 0.2)
js.append(f'tl.to(".spks", {{ opacity: 0, y: -14, duration: 0.18 }}, {T(s4["out_out"] + 0.02)});')

# ------------------------------------------------------------------ 4. straight to you + same-day (seg 5)
s5 = segs[5]
over.append(f'<div class="top" id="qual"><div class="pill dark" id="q1"><i class="ok">{ICON["check"]}</i>Jobs straight to you</div>'
            f'<div class="pill gold" id="q2"><i>{ICON["clock"]}</i>Same-day attention</div></div>')
show("#q1", word_t("straight", 5) - 0.05, s5["out_out"] + 0.1)
show("#q2", word_t("same-day", 5) - 0.05, s5["out_out"] + 0.1)

# ------------------------------------------------------------------ 5. 18 tradesmen, same model (seg 6)
s6 = segs[6]
over.append(f'<div class="top" id="sub"><div class="pill gold big" id="g1"><i>{ICON["user"]}</i><span id="t18">0</span>&nbsp;tradesmen across NZ</div>'
            f'<div class="pill dark" id="g2"><i class="g">{ICON["check"]}</i>All on the same model</div></div>')
t18 = word_t("18", 6)
show("#g1", t18 - 0.08, s6["out_out"] + 0.1)
js.append(f'tl.to("#t18", {{ duration: 0.6, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#t18", 18] }}, {T(t18 - 0.02)});')
show("#g2", word_t("same", 6) - 0.05, s6["out_out"] + 0.1)

# ------------------------------------------------------------------ 6. CTA (seg 7): seeing this ad = your area is available
s7 = segs[7]
t_seeing, t_area7 = word_t("seeing", 7), word_t("area", 7)
over.append(f'<div class="top" id="avail"><div class="atitle" id="at">SEEING THIS AD?</div>'
            f'<div class="pill gold big" id="aok"><i>{ICON["check"]}</i>YOUR AREA IS AVAILABLE</div><div class="aring" id="aring"></div></div>')
show("#at", t_seeing - 0.05, TOTAL + 0.2, frm="{ opacity: 0, y: 20, scale: 1.3 }", ease="power3.out")
show("#aok", t_area7 - 0.1, TOTAL + 0.2, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.4)")
js.append(f'tl.fromTo("#aring", {{ opacity: 0.9, scale: 0.85 }}, {{ opacity: 0, scale: 1.35, duration: 0.7, ease: "power2.out" }}, {T(t_area7 + 0.15)});')
js.append(f'tl.fromTo("#aok", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.35, repeat: 3, yoyo: true, ease: "sine.inOut", immediateRender: false }}, {T(word_t("click", 7))});')
over.append(f'<div class="cta" id="cta"><i>{ICON["check"]}</i>Fill out the form &middot; quick call</div>')
show("#cta", word_t("form", 7) - 0.1, TOTAL + 0.2)

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
.cg.early {{ top:1215px; }}
.wanted {{ position:absolute; left:50%; top:1442px; width:660px; margin-left:-330px; height:112px; display:flex; align-items:center; justify-content:center;
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
    <title>Handymen</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{T(TOTAL)}">
      <div id="cam">
{chr(10).join('        ' + c for c in clips)}
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
json.dump(dict(total=TOTAL, segments=segs, broll=[BROLL_IN, BROLL_OUT],
               phones=[dict(cid=r["cid"], t_in=segs[r["seg"]]["out_in"]) for r in RES]), open("timeline.json", "w"), indent=1)
print(f"total {TOTAL}s, {len(segs)} segments, {len(CAP)} caption groups, b-roll {BROLL_IN:.2f}-{BROLL_OUT:.2f}")
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
