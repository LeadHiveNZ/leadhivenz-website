#!/usr/bin/env python3
"""HostFix launch video: seven phone takes cut into one tight talking-head piece with app screens,
stickers, word-by-word captions and punch-ins. Inputs: edl.json, transcript.json, assets/source.mp4
(HLG->SDR concat of the takes), assets/voice_master.wav (voice cut to the EDL, noise-only cleanup)."""
import json, html, re

W, H = 1080, 1920
NAVY, NAVY2, GOLD, CREAM, INK = "#2B1631", "#3A2142", "#D7EC4C", "#F5F2EA", "#140A17"
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
    nxt_t = raw[i + 1]["text"] if i + 1 < len(raw) else ""
    if txt == "call" and nxt_t == "out":
        txt, skip = "call-out", True
    elif txt == "twenty" and nxt_t == "five":
        txt, skip = "25", True
    txt = {"fifteen": "15", "block": "blocked"}.get(txt, txt)
    if txt == "app." and nxt_t == "and":
        txt = "app"
    st = max(st, segs[seg]["src_in"] + 0.03)
    words.append(dict(text=txt, start=to_out(min(st, segs[seg]["src_out"] - 0.05)), seg=seg))
# the founding-properties line now ends on "properties" (the "in Queenstown at half price" tail is cut)
words = [w for w in words if not (w["seg"] == 5 and w["text"].lower().startswith(("in", "queenstown")))]
for w in words:
    if w["seg"] == 5 and w["text"].lower().startswith("properties"):
        w["text"] = "properties."
for k in range(1, len(words)):
    if words[k]["start"] < words[k - 1]["start"] + 0.07:
        words[k]["start"] = round(words[k - 1]["start"] + 0.07, 3)
def word_t(text, seg, nth=0):
    hits = [w["start"] for w in words if w["seg"] == seg and w["text"].lower().strip(",.") == text.lower()]
    return hits[nth]

# ------------------------------------------------------------------ captions (2-3 words, key word gold)
KEY = set("""airbnb app maintenance leaking shower power outage blocked drain price call-out fee 15 minutes cleaner qr code text step upload sorted 25 founding free link form video call""".split())
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
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("i've", 0))});')            # beats inside the longer takes
js.append(f'tl.set("#cam", {{ scale: 1.0 }}, {T(word_t("your", 3))});')
js.append(f'tl.set("#cam", {{ scale: 1.075 }}, {T(word_t("fill", 6))});')

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
    "drop": '<svg viewBox="0 0 24 24"><path d="M12 2.5S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5z" fill="currentColor"/></svg>',
    "qr": '<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2M19 14h2" stroke="currentColor" stroke-width="2.4"/></svg>',
    "chat": '<svg viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4z" fill="currentColor"/></svg>',
    "broom": '<svg viewBox="0 0 24 24"><path d="M14 3l-3.5 8M6 12h9l2 9H4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    "tag": '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" fill="currentColor"/><circle cx="7.5" cy="8" r="1.8" fill="#2B1631"/></svg>',
})

def ts(text, seg, nth=0):
    return word_t(text, seg, nth)

# ------------------------------------------------------------------ 1. hook (seg 0)
s0 = segs[0]
over.append(f'<div class="top" id="hook"><div class="pill lime" id="h1"><i>{ICON["home"]}</i>AIRBNB OWNERS</div>'
            f'<div class="pill plum" id="h2"><i class="lm">{ICON["bolt"]}</i>Built for you</div></div>')
show("#h1", ts("airbnb", 0) - 0.04, s0["out_out"])
show("#h2", ts("built", 0) - 0.04, s0["out_out"])

# ------------------------------------------------------------------ phone B-roll helper (app screenshots)
PH = []
def phone(pid, img, t_in, t_out, side=1, label=None):
    lab = f'<div class="ptag" id="{pid}-tag">{label}</div>' if label else ""
    over.append(f'<div class="phonewrap" id="{pid}">{lab}<div class="phone"><img src="assets/shots/{img}" alt="" /></div></div>')
    js.append(f'tl.fromTo("#{pid}", {{ opacity: 1, x: {1100 * side}, rotation: {5 * side} }}, {{ x: 0, rotation: 0, duration: 0.3, ease: "power3.out" }}, {T(t_in)});')
    js.append(f'tl.to("#{pid}", {{ x: {-1100 * side}, rotation: {-5 * side}, duration: 0.24, ease: "power3.in" }}, {T(t_out - 0.24)});')
    js.append(f'tl.set("#{pid}", {{ visibility: "hidden" }}, {T(t_out)});')
    if label:
        js.append(f'tl.fromTo("#{pid}-tag", {{ opacity: 0, scale: 0.4, y: 20 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.26, ease: "back.out(2.6)" }}, {T(t_in + 0.18)});')
    PH.append((t_in, t_out))

def sticker(sid, html_, x, y, rot, t_in, t_out, cls="lime"):
    over.append(f'<div class="stk {cls}" id="{sid}" style="left:{x}px; top:{y}px;">{html_}</div>')
    js.append(f'tl.fromTo("#{sid}", {{ opacity: 0, scale: 0.3, rotation: {rot * 3} }}, {{ opacity: 1, scale: 1, rotation: {rot}, duration: 0.24, ease: "back.out(2.4)" }}, {T(t_in)});')
    js.append(f'tl.to("#{sid}", {{ opacity: 0, scale: 0.8, duration: 0.14 }}, {T(t_out - 0.14)});')
    js.append(f'tl.set("#{sid}", {{ visibility: "hidden" }}, {T(t_out)});')

# ------------------------------------------------------------------ 2. the app sorts your maintenance (seg 1): home screen + issue stickers
s1 = segs[1]
t_app = ts("app", 1)
phone("ph1", "s1.png", t_app - 0.08, s1["out_out"], 1, "HostFix")
sticker("k1", f'<i>{ICON["drop"]}</i>Leaking shower', 40, 900, -6, ts("leaking", 1) - 0.04, s1["out_out"] - 0.05)
sticker("k2", f'<i>{ICON["bolt"]}</i>Power outage', 640, 1010, 5, ts("power", 1) - 0.04, s1["out_out"] - 0.05)
sticker("k3", f'<i>{ICON["drop"]}</i>Blocked drain', 70, 1120, -4, ts("blocked", 1) - 0.04, s1["out_out"] - 0.05)

# ------------------------------------------------------------------ 3. fixed prices, no call-out fee, locked in (seg 2)
s2 = segs[2]
t_locked = ts("someone's", 2)
phone("ph2", "s2.png", s2["out_in"] - 0.04, t_locked, -1, "Fixed prices")
sticker("k4", f'<i>{ICON["tag"]}</i>No call-out fee', 560, 1080, 6, ts("call-out", 2) - 0.06, t_locked)
over.append(f'<div class="top" id="lock"><div class="pill lime big" id="lk1"><i>{ICON["clock"]}</i>Tradie locked in</div>'
            f'<div class="pill plum" id="lk2">within <b id="m15">0</b>&nbsp;minutes</div></div>')
show("#lk1", t_locked + 0.02, s2["out_out"] + 0.1)
show("#lk2", ts("within", 2) - 0.04, s2["out_out"] + 0.1)
js.append(f'tl.to("#m15", {{ duration: 0.45, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#m15", 15] }}, {T(ts("15", 2) - 0.05)});')

# ------------------------------------------------------------------ 4. cleaner / guest QR / texts (seg 3)
s3 = segs[3]
t_guest, t_text = ts("your", 3, 1), ts("you", 3)
over.append(f'<div class="top" id="cln"><div class="pill plum" id="cl1"><i class="lm">{ICON["broom"]}</i>Your cleaner reports it</div></div>')
show("#cl1", ts("cleaner", 3) - 0.06, t_guest)
phone("ph3", "s4.png", t_guest - 0.04, t_text - 0.04, 1, "Guests scan a QR")
phone("ph4", "s3.png", t_text - 0.04, s3["out_out"], -1, "Texted at every step")
sticker("k5", f'<i>{ICON["chat"]}</i>Every single step', 470, 1120, 5, ts("every", 3) - 0.04, s3["out_out"] - 0.05)

# ------------------------------------------------------------------ 5. upload it, sorted (seg 4)
s4 = segs[4]
t_sorted = ts("sorted", 4)
phone("ph5", "s5.png", ts("upload", 4) - 0.1, t_sorted - 0.05, 1, "You say yes")
over.append(f'<div class="sorted" id="srt"><div class="sring" id="sring"></div><div class="scheck">{ICON["check"]}</div><div class="stext">SORTED</div></div>')
js.append(f'tl.fromTo("#srt", {{ opacity: 0, scale: 0.4 }}, {{ opacity: 1, scale: 1, duration: 0.26, ease: "back.out(2.2)" }}, {T(t_sorted - 0.05)});')
js.append(f'tl.fromTo("#sring", {{ opacity: 0.9, scale: 0.8 }}, {{ opacity: 0, scale: 1.8, duration: 0.6, ease: "power2.out" }}, {T(t_sorted + 0.05)});')
js.append(f'tl.to("#srt", {{ opacity: 0, scale: 1.1, duration: 0.16 }}, {T(s4["out_out"] + 0.05)});')
js.append(f'tl.set("#srt", {{ visibility: "hidden" }}, {T(s4["out_out"] + 0.22)});')

# ------------------------------------------------------------------ 6. 25 founding properties, free subscription (seg 5)
s5 = segs[5]
over.append(f'<div class="top" id="fnd"><div class="ftile" id="f1"><div class="fnum" id="n25">0</div><div class="flab">FOUNDING<br>PROPERTIES</div></div>'
            f'<div class="pill plum big" id="f2"><i class="lm">{ICON["check"]}</i>Free subscription</div></div>')
F_OUT = ts("fill", 6) - 0.15                  # hold the offer into the CTA until the steps card arrives
show("#f1", ts("25", 5) - 0.1, F_OUT, frm="{ opacity: 0, y: 30, scale: 0.6 }", ease="back.out(2.2)")
js.append(f'tl.to("#n25", {{ duration: 0.5, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n25", 25] }}, {T(ts("25", 5) - 0.05)});')
show("#f2", ts("founding", 5) - 0.05, F_OUT, frm="{ opacity: 0, y: 30, scale: 0.5 }", ease="back.out(2.6)")

# ------------------------------------------------------------------ 7. CTA (seg 6)
s7 = segs[6]
over.append(f'<div class="cta" id="cta"><i>{ICON["down"]}</i>LINK BELOW</div>')
show("#cta", ts("click", 6) - 0.05, TOTAL + 0.2)
js.append(f'tl.to("#cta i", {{ y: 10, duration: 0.3, repeat: 5, yoyo: true, ease: "sine.inOut" }}, {T(ts("click", 6) + 0.25)});')
steps = [("1", "Fill out the form", "form"), ("2", "Watch how it works", "watch"), ("3", "I'll give you a call", "i'll")]
rows = "".join(f'<div class="srow" id="st{k}"><b>{n}</b><span>{esc(t)}</span><i class="stick" id="sk{k}">{ICON["check"]}</i></div>' for k, (n, t, w) in enumerate(steps))
over.append(f'<div class="top" id="steps"><div class="scard">{rows}</div></div>')
for k, (n, t, w) in enumerate(steps):
    tw = ts(w, 6)
    show(f"#st{k}", tw - 0.12, TOTAL + 0.2, frm="{ opacity: 0, x: -40, y: 0, scale: 1 }", ease="power3.out")
    js.append(f'tl.fromTo("#sk{k}", {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.2, ease: "back.out(3)" }}, {T(tw + 0.2)});')

# phone B-roll: blur the camera while any phone is up
spans = []
for a, b in sorted(PH):
    if spans and a <= spans[-1][1] + 0.05:
        spans[-1][1] = max(spans[-1][1], b)
    else:
        spans.append([a, b])
for a, b in spans:
    js.append(f'tl.to("#cam", {{ filter: "blur(22px) brightness(0.55)", duration: 0.2, ease: "power2.out" }}, {T(a - 0.02)});')
    js.append(f'tl.to("#cam", {{ filter: "blur(0px) brightness(1)", duration: 0.22, ease: "power2.out" }}, {T(b - 0.12)});')
    js.append(f'tl.fromTo("#scrim", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, {T(a - 0.02)});')
    js.append(f'tl.to("#scrim", {{ opacity: 0, duration: 0.22 }}, {T(b - 0.12)});')
SFX = [a for a, b in sorted(PH)]

# ------------------------------------------------------------------ captions
cb = []
for gi, g in enumerate(CAP):
    spans = "".join(f'<span class="cw{" key" if wi in g["keys"] else ""}" id="cw{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    early = ""
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
    <title>HostFix launch</title>
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
