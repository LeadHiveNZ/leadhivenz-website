#!/usr/bin/env python3
"""HyperFrames composition for the Claude AI workshop Meta ad v3 (main take + P.S. in one file).

Inputs: edl-in.json (cut lists in source seconds), transcript.json (Parakeet words), assets/.
Writes index.html, compositions/*.html, edl.json. Audio is built separately by audio.py and
muxed after render, so every <video> here is muted.

Safe zones (Reels UI): nothing drawn above y=269 (top 14%) or below y=1536 (bottom 20%).
"""
import json, html, re

W, H = 1080, 1920
TOP_SAFE, BOTTOM_SAFE = int(H * 0.14), int(H * 0.80)  # 268, 1536
NAVY, NAVY90, CREAM, GOLD = "#0A1628", "rgba(10,22,40,0.90)", "#F5F2EA", "#FFB900"
FONT = "Montserrat, sans-serif"
EMOJI_FONT = "Montserrat, 'Noto Color Emoji', sans-serif"
EMOJI_FACE = "@font-face { font-family: 'Noto Color Emoji'; src: url('assets/fonts/NotoColorEmoji.ttf'); }"
SRC = "assets/source.mp4"

c = json.load(open("edl-in.json"))
D, PS_CARD, HOLD, END_CARD = c["D"], c["ps_card"], c["hold"], c["end_card"]

# ---- timeline layout ----------------------------------------------------------------
segs, t = [], 0.0
for i, (a, b) in enumerate(c["main"]):
    s = t if i == 0 else t - D
    segs.append(dict(src_in=a, src_out=b, out_in=round(s, 3), out_out=round(s + b - a, 3), part="main"))
    t = s + b - a
MAIN_END = round(t, 3)
PS_CARD_AT = MAIN_END
t = MAIN_END + PS_CARD
PS_START = round(t, 3)
for i, (a, b) in enumerate(c["ps"]):
    s = t if i == 0 else t - D
    segs.append(dict(src_in=a, src_out=b, out_in=round(s, 3), out_out=round(s + b - a, 3), part="ps"))
    t = s + b - a
PS_END = round(t, 3)
END_AT = round(PS_END + HOLD, 3)
TOTAL = round(END_AT + END_CARD, 3)


def to_out(s):
    for sg in segs:
        if sg["src_in"] <= s <= sg["src_out"]:
            return round(sg["out_in"] + (s - sg["src_in"]), 3)
    raise ValueError(f"source time {s} is not in a kept range")


def esc(s):
    return html.escape(s, quote=True)


# ---- words -> output time ------------------------------------------------------------
FIX = {"50.": "$50.", "7.30pm.": "7:30pm."}
ASR_LAG = 0.05
words = []
for w in json.load(open("transcript.json")):
    if any(a <= w["start"] <= b for a, b in c["drop"]):
        continue  # intentionally removed line
    txt = FIX.get(w["text"], w["text"])
    s0 = w["start"] + ASR_LAG
    k = next((sg for sg in segs if sg["src_in"] <= s0 <= sg["src_out"]), None)
    if k is None:  # timestamp falls in a removed pause: sentence-final words stay left, others open the next range
        prev = [sg for sg in segs if sg["src_out"] < s0]
        nxt = [sg for sg in segs if sg["src_in"] > s0]
        if txt[-1:] in ".?!," and prev:
            os_ = prev[-1]["out_out"] - 0.25
        else:
            os_ = nxt[0]["out_in"] + 0.02
    else:
        os_ = k["out_in"] + (s0 - k["src_in"])
    words.append(dict(text=txt, start=round(os_, 3), part="ps" if w["start"] >= c["ps"][0][0] - 0.1 else "main"))
words[0]["start"] = max(words[0]["start"], to_out(0.24))
for i in range(1, len(words)):
    if words[i]["start"] < words[i - 1]["start"] + 0.06:
        words[i]["start"] = round(words[i - 1]["start"] + 0.06, 3)
for i, w in enumerate(words):
    nxt = words[i + 1]["start"] if i + 1 < len(words) else PS_END
    w["end"] = round(min(nxt, w["start"] + 0.6), 3)

# ---- chat panel timing (P.S.): "Posted" lands as the last word ends -------------------
SPEECH_END = to_out(36.88)
T_POSTED = SPEECH_END - 0.02
T_POSTING = T_POSTED - 0.60
T_EDIT = T_POSTING - 1.05
T_VOICE = T_EDIT - 1.10
T_PANEL = T_VOICE - 0.30

# ---- caption groups --------------------------------------------------------------------
STOP = set("a an the and or of to for in on at it is it's i i'm i'll my your you you're if can even do just that this with by be have has are was will".split())
PRIORITY = set("""thousand bucks $50. 40 tradies booked seats. 90 minutes claude heavy lifting business. promise automate five hours admin
win 10% jobs refund. tech skills recording. wednesday 28th october 7:30pm. last chance tickets. wondering edited video
created ad voice prompt. absolute full""".split())


def key_index(g):
    def score(w):
        t = w["text"].lower().strip(",.")
        if re.search(r"[\d$%]", t):
            return 6
        if w["text"].lower() in PRIORITY or t in PRIORITY:
            return 4 + len(t) / 100
        if w["text"][:1].isupper() and t not in STOP:
            return 3
        return 0 if t in STOP else 1 + len(t) / 100
    best = max(range(len(g)), key=lambda i: score(g[i]))
    return best if score(g[best]) >= 1 else -1


groups, cur = [], []
cap_words = [w for w in words if w["start"] < T_PANEL]  # captions hand over to the headline once the chat panel is up
for i, w in enumerate(cap_words):
    cur.append(w)
    nxt = cap_words[i + 1] if i + 1 < len(cap_words) else None
    brk = (nxt is None or len(cur) >= 4 or w["text"][-1:] in ".?!" or (w["text"][-1:] == "," and len(cur) >= 2)
           or (nxt and nxt["start"] - w["start"] > 0.9) or (nxt and nxt["part"] != w["part"]))
    if brk:
        FUNC = {"a", "an", "the", "for", "of", "to", "and", "your", "with", "on", "at", "it", "i'll", "that", "is", "or", "by", "if", "can", "do"}
        carry = []
        if len(cur) > 2 and cur[-1]["text"].lower() in FUNC and cur[-1]["text"][-1:] not in ".?!,":
            carry.insert(0, cur.pop())
        groups.append(cur)
        cur = carry
if cur:
    groups.append(cur)
folded = []
for g in groups:  # no lone words unless the line before already ended a sentence
    if folded and len(g) == 1 and folded[-1][-1]["text"][-1:] not in ".?!" and len(folded[-1]) < 4 and g[0]["part"] == folded[-1][-1]["part"]:
        folded[-1] = folded[-1] + g
    else:
        folded.append(g)
# rebalance: no line on screen for less than ~0.5 s
def dur(gs, i):
    nxt = gs[i + 1][0]["start"] if i + 1 < len(gs) else gs[i][-1]["start"] + 0.5
    return nxt - gs[i][0]["start"]
changed = True
while changed:
    changed = False
    for i in range(len(folded)):
        g = folded[i]
        if dur(folded, i) >= 0.5 or g[-1]["text"][-1:] in ".?!":
            continue
        nx = folded[i + 1] if i + 1 < len(folded) and folded[i + 1][0]["part"] == g[0]["part"] else None
        pv = folded[i - 1] if i > 0 and folded[i - 1][-1]["part"] == g[0]["part"] else None
        if nx and len(g) + len(nx) <= 4:
            folded[i:i + 2] = [g + nx]
        elif nx and len(nx) >= 3:
            folded[i] = g + [nx[0]]
            folded[i + 1] = nx[1:]
        elif pv and len(pv) + len(g) <= 4 and pv[-1]["text"][-1:] not in ".?!":
            folded[i - 1:i + 1] = [pv + g]
        else:
            continue
        changed = True
        break
GROUPS = []
for gi, g in enumerate(folded):
    s = g[0]["start"]
    nxt_s = folded[gi + 1][0]["start"] if gi + 1 < len(folded) else T_PANEL
    limit = MAIN_END if g[-1]["part"] == "main" else T_PANEL
    e = min(g[-1]["start"] + 0.55, nxt_s - 0.03, limit)
    GROUPS.append(dict(start=s, end=round(e, 3), words=g, key=key_index(g)))

CAP_BOTTOM = 1528
CAP_TOP = 1380
assert CAP_TOP > TOP_SAFE and CAP_BOTTOM <= BOTTOM_SAFE


def sub_file(cid, css, body, js):
    return f"""<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>{cid}</title></head>
  <body>
    <template>
      <style>{css}</style>
      <div id="root" data-composition-id="{cid}" data-width="{W}" data-height="{H}">
{body}
      </div>
      <script>
        (function () {{
          const tl = gsap.timeline({{ paused: true }});
{js}
          window.__timelines["{cid}"] = tl;
        }})();
      </script>
    </template>
  </body>
</html>
"""


cap_css = f"""
#root {{ position:absolute; inset:0; font-family:{FONT}; }}
.cg {{ position:absolute; left:80px; right:80px; top:{CAP_TOP}px; height:{CAP_BOTTOM - CAP_TOP}px; display:flex; flex-wrap:wrap;
      justify-content:center; align-content:flex-end; gap:0 16px; text-align:center; opacity:0; overflow:visible; }}
.cw {{ display:inline-block; font-size:62px; font-weight:800; line-height:1.14; color:#FFFFFF; letter-spacing:-0.005em; opacity:0;
      will-change:transform; text-shadow:0 3px 14px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.65); }}
.cw.key {{ color:{GOLD}; }}
"""
cb, cj = [], []
for gi, g in enumerate(GROUPS):
    spans = "".join(f'<span class="cw{" key" if wi == g["key"] else ""}" id="cw-{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    cb.append(f'<div class="cg" id="cg-{gi}">{spans}</div>')
    cj.append(f'tl.set("#cg-{gi}", {{ opacity: 1 }}, {g["start"]:.3f});')
    for wi, w in enumerate(g["words"]):
        ws = max(g["start"], w["start"])
        cj.append(f'tl.fromTo("#cw-{gi}-{wi}", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.09, ease: "power2.out" }}, {ws:.3f});')
    cj.append(f'tl.set("#cg-{gi}", {{ opacity: 0, visibility: "hidden" }}, {g["end"]:.3f});')
cj.append(f"tl.set({{}}, {{}}, {TOTAL:.3f});")
open("compositions/captions.html", "w").write(sub_file("captions", cap_css, "\n".join(cb), "\n".join(cj)))

# ---- overlay cards (source-time cues) -----------------------------------------------------
CARD_TOP = 404
card_css = f"""
#root {{ position:absolute; inset:0; font-family:{FONT}; color:{CREAM}; }}
.row {{ position:absolute; left:60px; right:60px; top:{CARD_TOP}px; display:flex; justify-content:center; }}
.card {{ display:inline-flex; align-items:center; gap:22px; background:{NAVY90}; border-radius:30px; padding:22px 40px;
        font-weight:800; white-space:nowrap; box-shadow:0 18px 40px rgba(0,0,0,0.28); opacity:0; will-change:transform; transform-origin:50% 50%; }}
.g {{ color:{GOLD}; }}
.big {{ font-size:110px; letter-spacing:-0.02em; line-height:1; }}
.mid {{ font-size:66px; line-height:1.05; }}
.pop {{ display:none; opacity:0; will-change:transform; transform-origin:50% 60%; }}
.tick {{ width:62px; height:62px; flex:none; }}
"""


def card(cid, src_a, src_b, inner, extra=lambda L: ""):
    o0, o1 = to_out(src_a), to_out(src_b)
    dur = round(o1 - o0, 3)
    L = lambda s: max(0.0, round(to_out(s) - o0, 3))
    js = (f'tl.fromTo("#{cid}-c", {{ opacity: 0, scale: 0.86, y: 18 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "power3.out" }}, 0);\n'
          + extra(L)
          + f'tl.to("#{cid}-c", {{ opacity: 0, y: -12, duration: 0.2, ease: "power2.in" }}, {max(0.0, dur - 0.22):.3f});\n')
    open(f"compositions/{cid}.html", "w").write(sub_file(cid, card_css, f'<div class="row"><div class="card" id="{cid}-c">{inner}</div></div>', js))
    return dict(cid=cid, start=o0, dur=dur)


TICK_SVG = f'<svg class="tick" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="{GOLD}"/><path d="M18 33 l9 9 l19 -20" fill="none" stroke="{NAVY}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
hosts = [
    card("card-price", 3.00, 4.48,
         '<span class="big">$1,000</span><span class="big g">→</span><span class="big g pop" id="card-price-new">$50</span>',
         lambda L: (f'tl.set("#card-price-new", {{ display: "inline-block" }}, {L(4.10):.3f});\n'
                    f'tl.fromTo("#card-price-new", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.26, ease: "power3.out" }}, {L(4.10):.3f});\n'
                    f'tl.fromTo("#card-price-c", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.12, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }}, {L(4.10):.3f});\n')),
    card("card-booked", 5.92, 7.60, '<span class="mid"><span class="g">40</span> tradies booked</span>'),
    card("card-refund", 18.90, 20.76, '<span class="mid">Not worth it? <span class="g">Full refund</span></span>'),
    card("card-tech", 21.06, 22.70, TICK_SVG + '<span class="mid">No tech skills needed</span>'),
]

# ---- date badge (whole video) ---------------------------------------------------------------
BADGE_TOP = 292
badge_css = EMOJI_FACE + f"""
#root {{ position:absolute; inset:0; font-family:{EMOJI_FONT}; }}
.badge {{ position:absolute; top:{BADGE_TOP}px; right:56px; background:{NAVY}; color:{GOLD}; font-size:34px; font-weight:800;
         letter-spacing:0.02em; padding:13px 24px; border-radius:18px; white-space:nowrap; box-shadow:0 10px 26px rgba(0,0,0,0.30); }}
"""
open("compositions/badge.html", "w").write(sub_file("badge", badge_css,
    '<div class="badge" id="badge-b">📅 WED 28 OCT · 7:30PM NZT</div>', f"tl.set({{}}, {{}}, {TOTAL:.3f});"))

# ---- P.S. card ---------------------------------------------------------------------------------
open("compositions/ps-card.html", "w").write(sub_file("ps-card", f"""
#root {{ position:absolute; inset:0; background:{CREAM}; display:flex; align-items:center; justify-content:center; font-family:{FONT}; }}
.ps {{ font-size:300px; font-weight:800; color:{GOLD}; letter-spacing:-0.02em; line-height:1; }}
""", '<div class="ps" id="ps-t">P.S.</div>', f"tl.set({{}}, {{}}, {PS_CARD:.3f});"))

# ---- chat panel + headline (P.S.) ---------------------------------------------------------------
PANEL_TOP, PANEL_BOTTOM = 1270, 1526
HEAD_TOP, HEAD_BOTTOM = 1112, 1258
assert PANEL_BOTTOM <= BOTTOM_SAFE and HEAD_BOTTOM < PANEL_TOP
chat_start = round(T_PANEL, 3)
chat_dur = round(END_AT - chat_start, 3)
L = lambda t_: round(t_ - chat_start, 3)
BARS = 16
bars = "".join(f'<span class="bar" id="chat-bar-{i}"></span>' for i in range(BARS))
typed = "Editing your ad…"
chars = "".join(f'<span class="ch" id="chat-ch-{i}">{esc(ch) if ch != " " else "&nbsp;"}</span>' for i, ch in enumerate(typed))
chat_css = EMOJI_FACE + f"""
#root {{ position:absolute; inset:0; font-family:{EMOJI_FONT}; }}
.head {{ position:absolute; left:70px; right:70px; top:{HEAD_TOP}px; height:{HEAD_BOTTOM - HEAD_TOP}px; display:flex; flex-direction:column;
        justify-content:flex-end; text-align:center; font-size:48px; font-weight:800; line-height:1.14; color:{CREAM}; opacity:0;
        text-shadow:0 3px 14px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.7); will-change:transform; }}
.head .g {{ color:{GOLD}; }}
.panel {{ position:absolute; left:96px; right:96px; top:{PANEL_TOP}px; height:{PANEL_BOTTOM - PANEL_TOP}px; background:{NAVY};
         border-radius:40px; padding:26px 30px; box-sizing:border-box; display:flex; flex-direction:column; gap:18px;
         box-shadow:0 22px 50px rgba(0,0,0,0.35); opacity:0; will-change:transform; }}
.r1 {{ display:flex; justify-content:flex-end; }}
.voice {{ display:inline-flex; align-items:center; gap:16px; background:{GOLD}; color:{NAVY}; border-radius:28px 28px 8px 28px;
         padding:14px 22px; font-size:30px; font-weight:800; opacity:0; will-change:transform; }}
.wave {{ display:flex; align-items:center; gap:5px; height:44px; }}
.bar {{ display:block; width:6px; height:40px; border-radius:3px; background:{NAVY}; transform:scaleY(0.25); transform-origin:50% 50%; will-change:transform; }}
.r2 {{ display:flex; justify-content:flex-start; }}
.reply {{ position:relative; width:640px; height:96px; background:#16243C; color:{CREAM}; border-radius:28px 28px 28px 8px;
         padding:16px 22px; box-sizing:border-box; opacity:0; will-change:transform; }}
.line {{ position:absolute; left:22px; right:22px; top:14px; font-size:32px; font-weight:800; white-space:nowrap; }}
.ch {{ opacity:0; }}
.l2, .l3 {{ opacity:0; }}
.l3 {{ display:flex; align-items:center; gap:14px; color:{GOLD}; top:20px; font-size:38px; }}
.track {{ position:absolute; left:22px; right:22px; bottom:18px; height:10px; border-radius:5px; background:rgba(245,242,234,0.18); overflow:hidden; }}
.fill {{ display:block; width:100%; height:100%; background:{GOLD}; transform:scaleX(0); transform-origin:0% 50%; will-change:transform; }}
.mini {{ width:44px; height:44px; flex:none; }}
"""
chat_body = f"""
<div class="head" id="chat-head"><div>This ad was edited and posted by Claude. <span class="g">One voice prompt.</span></div></div>
<div class="panel" id="chat-panel">
  <div class="r1"><div class="voice" id="chat-voice"><span>🎙️ Voice prompt</span><span class="wave">{bars}</span></div></div>
  <div class="r2"><div class="reply" id="chat-reply">
    <div class="line l1" id="chat-l1">{chars}</div>
    <div class="line l2" id="chat-l2">Posting to Facebook…</div>
    <div class="line l3" id="chat-l3">{TICK_SVG.replace('class="tick"', 'class="mini"')}<span>Posted ✓</span></div>
    <div class="track" id="chat-track"><span class="fill" id="chat-fill"></span></div>
  </div></div>
</div>"""
cjs = []
cjs.append('tl.fromTo("#chat-panel", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, 0);')
cjs.append('tl.fromTo("#chat-head", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, 0.05);')
cjs.append(f'tl.fromTo("#chat-voice", {{ opacity: 0, scale: 0.85 }}, {{ opacity: 1, scale: 1, duration: 0.22, ease: "power3.out" }}, {L(T_VOICE):.3f});')
# waveform: deterministic per-bar heights pulsing for ~1s
for i in range(BARS):
    seq = [0.35 + 0.6 * abs(((i * 7 + k * 5) % 11) / 10 - 0.5) * 2 for k in range(6)]
    t0 = L(T_VOICE) + 0.1
    for k, v in enumerate(seq):
        cjs.append(f'tl.to("#chat-bar-{i}", {{ scaleY: {min(1.0, v):.2f}, duration: 0.16, ease: "sine.inOut" }}, {t0 + k * 0.165:.3f});')
    cjs.append(f'tl.to("#chat-bar-{i}", {{ scaleY: 0.25, duration: 0.15, ease: "sine.out" }}, {t0 + 6 * 0.165:.3f});')
cjs.append(f'tl.fromTo("#chat-reply", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.2, ease: "power3.out" }}, {L(T_EDIT):.3f});')
type_span = 0.55
for i in range(len(typed)):
    cjs.append(f'tl.set("#chat-ch-{i}", {{ opacity: 1 }}, {L(T_EDIT) + 0.12 + i * type_span / len(typed):.3f});')
cjs.append(f'tl.fromTo("#chat-fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.85, ease: "power1.inOut" }}, {L(T_EDIT) + 0.12:.3f});')
cjs.append(f'tl.set("#chat-l1", {{ opacity: 0 }}, {L(T_POSTING):.3f});')
cjs.append(f'tl.set("#chat-l2", {{ opacity: 1 }}, {L(T_POSTING):.3f});')
cjs.append(f'tl.set("#chat-fill", {{ scaleX: 0 }}, {L(T_POSTING):.3f});')
cjs.append(f'tl.to("#chat-fill", {{ scaleX: 1, duration: 0.55, ease: "power1.in" }}, {L(T_POSTING) + 0.01:.3f});')
cjs.append(f'tl.set(["#chat-l2", "#chat-track"], {{ opacity: 0 }}, {L(T_POSTED):.3f});')
cjs.append(f'tl.fromTo("#chat-l3", {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.22, ease: "power3.out" }}, {L(T_POSTED):.3f});')
cjs.append(f"tl.set({{}}, {{}}, {chat_dur:.3f});")
open("compositions/chat.html", "w").write(sub_file("chat", chat_css, chat_body, "\n".join(cjs)))

# ---- end card -----------------------------------------------------------------------------------
open("compositions/endcard.html", "w").write(sub_file("endcard", f"""
#root {{ position:absolute; inset:0; background:{NAVY}; font-family:{FONT}; color:{CREAM}; display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:34px; text-align:center; padding:0 80px; box-sizing:border-box; }}
.t1 {{ font-size:84px; font-weight:800; line-height:1.08; letter-spacing:-0.01em; }}
.t1 .g {{ color:{GOLD}; }}
.t2 {{ font-size:42px; font-weight:700; line-height:1.3; opacity:0.95; }}
.t3 {{ font-size:64px; font-weight:800; color:{GOLD}; }}
.e {{ opacity:0; will-change:transform; }}
""", """
<div class="t1 e" id="ec-1"><span class="g">Claude</span> AI Workshop for Tradies</div>
<div class="t2 e" id="ec-2">Wed 28 Oct · 7:30pm NZT · Live on Zoom</div>
<div class="t3 e" id="ec-3">$50 · Tap Book Now</div>""",
"\n".join(f'tl.fromTo("#ec-{i}", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {0.04 + (i - 1) * 0.12:.2f});' for i in (1, 2, 3))
+ f"\ntl.set({{}}, {{}}, {END_CARD:.3f});"))

# ---- index.html: footage, punch-ins, hosts ----------------------------------------------------
ORIGIN = (528, 1051)   # face centre in the 1080x1920 source: punch-ins keep the face where it is
S, TX, TY, PUNCH = 1.17, 12, -147, 1.08
# change points (source seconds): sentence starts, plus a mid-sentence point wherever a sentence runs past ~3 s
CHANGE_SRC = [3.55, 5.92, 7.95, 9.60, 12.24, 13.68, 15.76, 18.16, 21.06, 22.32, 24.53, 27.76, 30.03, 32.56]
changes = sorted({to_out(s) for s in CHANGE_SRC} | {0.0})
tl_lines, zoom = [], False
for i, tc in enumerate(changes):
    if tc >= T_PANEL:
        break
    zoom = (i % 2 == 1) if tc > 0 else True  # first line punched in, then alternate
    tl_lines.append(f'      tl.set("#video-wrap", {{ scale: {S * (PUNCH if zoom else 1):.4f}, x: {TX}, y: {TY} }}, {tc:.3f});')
tl_lines.append(f'      tl.set("#video-wrap", {{ scale: {S:.4f}, x: {TX}, y: {TY} }}, {T_PANEL:.3f});')  # base framing while the panel covers the lower frame
tl_lines.append(f"      tl.set({{}}, {{}}, {TOTAL:.3f});")
gaps = [b - a for a, b in zip(changes, changes[1:])]

vids = []
for i, sg in enumerate(segs):
    vids.append(f'        <video id="v{i}" class="clip" src="{SRC}" muted playsinline data-start="{sg["out_in"]:.3f}" '
                f'data-duration="{sg["out_out"] - sg["out_in"]:.3f}" data-media-start="{sg["src_in"]:.3f}" data-track-index="0"></video>')
vids.append(f'        <img id="freeze" class="clip" src="assets/last.jpg" data-start="{PS_END:.3f}" data-duration="{HOLD:.3f}" data-track-index="0" alt="" />')


def host(cid, start, dur, track, kind):
    return (f'      <div id="{cid}-host" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" data-start="{start:.3f}" '
            f'data-duration="{dur:.3f}" data-track-index="{track}" data-track-kind="{kind}" data-width="{W}" data-height="{H}"></div>')


host_lines = [host(h["cid"], h["start"], h["dur"], 3, "graphics") for h in hosts]
host_lines += [host("ps-card", PS_CARD_AT, PS_CARD, 4, "graphics"), host("chat", chat_start, chat_dur, 4, "graphics"),
               host("endcard", END_AT, END_CARD, 4, "graphics"), host("captions", 0, TOTAL, 2, "captions"),
               host("badge", 0, TOTAL, 5, "graphics")]

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Claude AI workshop Meta ad v3</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: {NAVY}; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: {NAVY}; }}
      #video-wrap {{ position: absolute; inset: 0; transform-origin: {ORIGIN[0]}px {ORIGIN[1]}px; will-change: transform; }}
      #video-wrap video, #video-wrap img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{TOTAL:.3f}">
      <div id="video-wrap">
{chr(10).join(vids)}
      </div>
{chr(10).join(host_lines)}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tl_lines)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
json.dump(dict(segments=segs, main_end=MAIN_END, ps_start=PS_START, ps_end=PS_END, end_at=END_AT, total=TOTAL,
               chat=dict(panel=T_PANEL, voice=T_VOICE, edit=T_EDIT, posting=T_POSTING, posted=T_POSTED, speech_end=SPEECH_END),
               cards=hosts, groups=len(GROUPS), change_gaps=gaps), open("edl.json", "w"), indent=1)
print(f"total {TOTAL}s | main 0-{MAIN_END} | P.S. card {PS_CARD_AT}-{PS_START} | P.S. {PS_START}-{PS_END} | hold -> {END_AT} | end card -> {TOTAL}")
print(f"chat: panel {T_PANEL:.2f} voice {T_VOICE:.2f} edit {T_EDIT:.2f} posting {T_POSTING:.2f} posted {T_POSTED:.2f} (speech ends {SPEECH_END:.2f})")
print(f"frame changes every {min(gaps):.2f}-{max(gaps):.2f}s; first word at {words[0]['start']:.2f}s")
for h in hosts:
    print(f"  {h['cid']:12s} {h['start']:6.2f} +{h['dur']:.2f}")
for g in GROUPS:
    print(f"  {g['start']:6.2f}-{g['end']:6.2f}  " + " ".join(("[" + w['text'] + "]") if i == g['key'] else w['text'] for i, w in enumerate(g['words'])))
