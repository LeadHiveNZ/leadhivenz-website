#!/usr/bin/env python3
"""HyperFrames composition for 'AI workshop video 2'.

Kept source ranges (EDL) are joined with hard cuts (D-second audio blend only); the audio is a
pre-mixed track (assets/mix.m4a) built with matching acrossfades + loudnorm, so
video clips are muted and the <audio> carries the sound.
"""
import json, html

W, H = 1080, 1920
SRC = "assets/workshop2.mp4"
cfg = json.load(open("edl-in.json"))
EDL, D = cfg["EDL"], cfg["D"]

# output placement with overlap D at each join
segs, t = [], 0.0
for i, (a, b) in enumerate(EDL):
    start = t if i == 0 else t - D
    segs.append({"src_in": a, "src_out": b, "out_in": round(start, 3), "out_out": round(start + (b - a), 3)})
    t = start + (b - a)
TOTAL = round(t, 3)


def to_out(s, snap="next"):
    for sg in segs:
        if sg["src_in"] <= s <= sg["src_out"]:
            return round(sg["out_in"] + (s - sg["src_in"]), 3)
    if snap == "next":
        for sg in segs:
            if s < sg["src_in"]:
                return sg["out_in"]
        return TOTAL
    for sg in reversed(segs):
        if s > sg["src_out"]:
            return sg["out_out"]
    return 0.0


def kept(s):
    return any(sg["src_in"] <= s <= sg["src_out"] for sg in segs)


def esc(s):
    return html.escape(s, quote=True)


# ---- captions -------------------------------------------------------------------
FIX = {"7.30": "7:30", "so": "So", "10%": "10%"}
words = []
for w in json.load(open("transcript.json")):
    mid = (w["start"] + w["end"]) / 2
    if not kept(mid):
        continue
    txt = FIX.get(w["text"], w["text"])
    if abs(w["start"] - 30.16) < 0.05 and txt == "so":
        txt = "So"
    words.append({"text": txt, "start": to_out(w["start"]), "end": to_out(w["end"], "prev")})

groups, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    gap = (nxt["start"] - w["end"]) if nxt else 9
    sent_end = w["text"][-1:] in ".?!"
    comma = w["text"][-1:] == ","
    if nxt is None or len(cur) >= 5 or sent_end or (comma and len(cur) >= 3) or gap > 0.5:
        groups.append(cur)
        cur = []
GROUPS = []
for gi, g in enumerate(groups):
    s = g[0]["start"]
    nxt_s = groups[gi + 1][0]["start"] if gi + 1 < len(groups) else TOTAL
    e = min(g[-1]["end"] + 0.4, nxt_s - 0.04, TOTAL)
    GROUPS.append({"start": s, "end": round(e, 3), "words": g})

cap_css = """
#root { position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; }
.cg { position:absolute; left:90px; right:90px; top:1430px; height:170px; display:flex; flex-wrap:wrap; justify-content:center; align-content:flex-start;
      gap:0 16px; text-align:center; opacity:0; will-change:transform; overflow:visible; }
.cw { display:inline-block; font-size:56px; font-weight:800; line-height:1.2; color:#fff; letter-spacing:-0.005em; will-change:transform;
      text-shadow:0 3px 0 rgba(15,26,46,0.9), 0 0 2px rgba(15,26,46,0.9), 0 0 18px rgba(15,26,46,0.55); }
"""
cap_body, cap_js = [], []
for gi, g in enumerate(GROUPS):
    spans = "".join(f'<span class="cw" id="cw-{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    cap_body.append(f'<div class="cg" id="cg-{gi}">{spans}</div>')
    s, e = g["start"], g["end"]
    cap_js.append(f'tl.fromTo("#cg-{gi}", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }}, {s:.3f});')
    for wi, w in enumerate(g["words"]):
        ws = max(s, w["start"])
        we = g["words"][wi + 1]["start"] if wi + 1 < len(g["words"]) else e
        if we <= ws:
            we = ws + 0.05
        d_on = round(min(0.08, (we - ws) * 0.9), 3)
        cap_js.append(f'tl.fromTo("#cw-{gi}-{wi}", {{ color: "#ffffff" }}, {{ color: "#F5B335", duration: {d_on}, ease: "none" }}, {ws:.3f});')
        cap_js.append(f'tl.to("#cw-{gi}-{wi}", {{ color: "#ffffff", duration: 0.08, ease: "none" }}, {we:.3f});')
    x0 = max(s + 0.17, e - 0.12)
    cap_js.append(f'tl.to("#cg-{gi}", {{ opacity: 0, duration: {max(0.02, round(e - x0, 3))}, ease: "power2.in" }}, {x0:.3f});')
    cap_js.append(f'tl.set("#cg-{gi}", {{ opacity: 0, visibility: "hidden" }}, {e:.3f});')
cap_js.append(f'tl.set({{}}, {{}}, {TOTAL:.3f});')


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


open("compositions/captions.html", "w").write(sub_file("captions", cap_css, "\n".join(cap_body), "\n".join(cap_js)))

# ---- three small lower cards (source-time cues) ----------------------------------
card_css = """
#root { position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; color:#fff; }
.pillrow { position:absolute; left:90px; right:90px; top:1625px; height:96px; display:flex; justify-content:center; align-items:center; gap:14px; }
.pill { display:inline-flex; align-items:center; gap:14px; background:rgba(15,26,46,0.9); border-radius:999px; padding:16px 30px; font-size:34px; font-weight:800;
        letter-spacing:0.01em; will-change:transform; opacity:0; transform-origin:50% 50%; box-shadow:0 12px 30px rgba(15,26,46,0.3); }
.pill b { color:#EFA41E; font-weight:900; }
.dot { width:10px; height:10px; border-radius:50%; background:#EFA41E; display:inline-block; }
.arrow { display:inline-block; width:0; height:0; border-left:14px solid transparent; border-right:14px solid transparent; border-top:18px solid #EFA41E; margin-left:4px; will-change:transform; }
"""


def card(cid, src_a, src_b, inner, extra_js=""):
    o0, o1 = to_out(src_a), to_out(src_b, "prev")
    dur = round(o1 - o0, 3)
    body = f'<div class="pillrow"><div class="pill" id="{cid}-p">{inner}</div></div>'
    js = (f'tl.fromTo("#{cid}-p", {{ opacity: 0, scale: 0.9, y: 16 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power3.out" }}, 0);\n'
          + extra_js
          + f'tl.to("#{cid}-p", {{ opacity: 0, y: 12, duration: 0.25, ease: "power2.in" }}, {max(0, dur - 0.27):.3f});\n')
    open(f"compositions/{cid}.html", "w").write(sub_file(cid, card_css, body, js))
    return dict(cid=cid, start=o0, dur=dur)


hosts = [
    card("card-details", 4.40, 7.55, '<span>Wed 28 Oct</span><span class="dot"></span><b>7:30pm</b>'),
    card("card-refund", 24.45, 27.70, '<b>Full refund</b><span>no questions asked</span>'),
    card("card-link", 30.25, 32.97, '<span>Ticket link below</span><span class="arrow" id="card-link-a"></span>',
         'tl.fromTo("#card-link-a", { y: -4 }, { y: 6, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 3 }, 0.4);\n'),
]

# ---- index.html -------------------------------------------------------------------
SCALE = 1.15
vids, fades = [], []
for i, sg in enumerate(segs):
    vids.append(f'      <video id="v{i}" class="clip" src="{SRC}" muted playsinline data-start="{sg["out_in"]:.3f}" '
                f'data-duration="{sg["out_out"] - sg["out_in"]:.3f}" data-media-start="{sg["src_in"]:.3f}" data-track-index="0"></video>')
    sc = (SCALE if "SCALE" in globals() else 1.15) * (1.0 if i % 2 == 0 else 1.06)
    fades.append(f'      tl.set("#video-wrap", {{ scale: {sc:.3f}, y: -62 }}, {sg["out_in"]:.3f});')
# --- centring: follow the smoothed face centre with slow, linear x tweens -------------
face = json.load(open("face.json"))
pts = []
for r in face:
    if not kept(r["t"]):
        continue
    dx = (0.5 - r["cx"]) * W * SCALE
    pts.append((to_out(r["t"]), max(-80, min(80, dx))))
# smooth: 2s moving average, then keyframe every ~2s
sm = []
for i, (t, dx) in enumerate(pts):
    win = [d for (tt, d) in pts if abs(tt - t) <= 1.0]
    sm.append((t, sum(win) / len(win)))
keys = sm[::4] + ([sm[-1]] if sm[-1][0] > sm[::4][-1][0] else [])
fades.append(f'      tl.set("#video-wrap", {{ x: {keys[0][1]:.1f} }}, 0);')
for (t0, d0), (t1, d1) in zip(keys, keys[1:]):
    t0, t1 = round(t0, 3), round(t1, 3)
    if t1 <= t0:
        continue
    fades.append(f'      tl.to("#video-wrap", {{ x: {d1:.1f}, duration: {round(t1 - t0 - 0.003, 3)}, ease: "none" }}, {t0:.3f});')
fades.append(f'      tl.set({{}}, {{}}, {TOTAL:.3f});')
card_hosts = "\n".join(
    f'      <div id="{h["cid"]}-host" data-composition-id="{h["cid"]}" data-composition-src="compositions/{h["cid"]}.html" '
    f'data-start="{h["start"]:.3f}" data-duration="{h["dur"]:.3f}" data-track-index="2" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>'
    for h in hosts)

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Claude AI workshop for tradies 2</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #0F1A2E; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #0F1A2E; }}
      #video-wrap {{ position: absolute; inset: 0; transform-origin: 50% 50%; will-change: transform; }}
      #video-wrap video {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{TOTAL:.3f}">
      <div id="video-wrap">
{chr(10).join(vids)}
      </div>
      <audio id="mix" src="assets/mix.m4a" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="3" data-volume="1"></audio>
{card_hosts}
      <div id="captions-host" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="1" data-track-kind="captions" data-width="{W}" data-height="{H}"></div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(fades)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
json.dump({"segments": segs, "total": TOTAL, "cards": hosts, "caption_groups": len(GROUPS)}, open("edl.json", "w"), indent=1)
print(f"total {TOTAL}s, {len(GROUPS)} caption groups, {len(hosts)} cards")
for g in GROUPS:
    print(f"  {g['start']:6.2f}-{g['end']:6.2f}  " + " ".join(w['text'] for w in g['words']))
