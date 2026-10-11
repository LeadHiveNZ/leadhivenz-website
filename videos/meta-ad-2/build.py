#!/usr/bin/env python3
"""HyperFrames composition for the $500 website Meta ad (take: 'I was speaking to a tradie yesterday...').

Kept source ranges (edl-in.json) are joined with hard cuts; the sound is a pre-mixed
track (assets/mix.m4a, 40 ms joins + loudnorm), so video clips are muted.

Framing is built for Meta Reels placements: the video is lifted and centred so the
face sits in the upper-middle, and every caption / pill lives between the face and
the bottom 35% of the frame that Meta's ad UI (primary text + CTA) covers.
"""
import json, html

W, H = 1080, 1920
SRC = "assets/source.mp4"
cfg = json.load(open("edl-in.json"))
EDL, D = cfg["EDL"], cfg["D"]

# framing: base scale/offset (see BRIEF.md for the derivation), alternating punch-in per cut
BASE_SCALE, PUNCH = 1.24, 1.06
TX, TY = 59, -200

META_SAFE_BOTTOM = int(H * 0.65)  # 1248: nothing we draw may extend below this

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
FIX = {"trader": "tradie", "personalized": "personalised"}
ASR_LAG = 0.08  # Parakeet word starts land ~0.1s before the audible onset in this clip
raw = json.load(open("transcript.json"))
# merge "7:30" + "p.m.," into one caption word
merged = []
for w in raw:
    if merged and w["text"] in ("p.m.,", "p.m.", "pm,", "pm.") and merged[-1]["text"].endswith(":30"):
        merged[-1] = {**merged[-1], "text": merged[-1]["text"] + "pm" + w["text"][-1], "end": w["end"]}
    else:
        merged.append(dict(w))

# Every cut in this edit removes silence only, so every transcribed word is audible in the
# output. A word whose (early-biased) timestamp falls in a removed gap is assigned to a side:
# sentence-final words stay with the segment before the gap; anything else opens the next.
words = []
for i, w in enumerate(merged):
    txt = FIX.get(w["text"], w["text"])
    s0 = w["start"] + ASR_LAG
    e0 = w["end"] + ASR_LAG
    k = next((j for j, sg in enumerate(segs) if sg["src_in"] <= s0 <= sg["src_out"]), None)
    if k is not None:
        sg = segs[k]
        os_ = sg["out_in"] + (s0 - sg["src_in"])
        oe = min(sg["out_out"], sg["out_in"] + (e0 - sg["src_in"]))
    else:
        prev = max((j for j, sg in enumerate(segs) if sg["src_out"] < s0), default=None)
        nxt = min((j for j, sg in enumerate(segs) if sg["src_in"] > s0), default=None)
        goes_prev = nxt is None or (prev is not None and txt[-1:] in ".?!,")
        if goes_prev:
            sg = segs[prev]
            os_ = max(sg["out_in"], sg["out_out"] - 0.32)
            oe = sg["out_out"]
        else:
            sg = segs[nxt]
            os_ = sg["out_in"]
            oe = sg["out_in"] + (e0 - s0)
    words.append({"text": txt, "start": round(os_, 3), "end": round(max(oe, os_ + 0.06), 3)})
# keep starts monotonic with a minimum spacing (several gap words can land on one boundary)
for i in range(1, len(words)):
    if words[i]["start"] < words[i - 1]["start"] + 0.08:
        words[i]["start"] = round(words[i - 1]["start"] + 0.08, 3)
        words[i]["end"] = max(words[i]["end"], words[i]["start"] + 0.06)
assert len(words) == len(merged), "a spoken word was dropped from the captions"

groups, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    gap = (nxt["start"] - w["end"]) if nxt else 9
    sent_end = w["text"][-1:] in ".?!"
    comma = w["text"][-1:] == ","
    if nxt is None or len(cur) >= 4 or sent_end or (comma and len(cur) >= 2) or gap > 0.45:
        groups.append(cur)
        cur = []
# fold a lone word into the line before it unless that line already ends a sentence
folded = []
for g in groups:
    if folded and len(g) == 1 and folded[-1][-1]["text"][-1:] not in ".?!" and len(folded[-1]) <= 4:
        folded[-1] = folded[-1] + g
    else:
        folded.append(g)
groups = folded
GROUPS = []
for gi, g in enumerate(groups):
    s = g[0]["start"]
    nxt_s = groups[gi + 1][0]["start"] if gi + 1 < len(groups) else TOTAL
    e = min(g[-1]["end"] + 0.35, nxt_s - 0.04, TOTAL)
    GROUPS.append({"start": s, "end": round(e, 3), "words": g})

CAP_TOP, CAP_H = 1040, 130  # two 54px lines max; bottom 1170
PILL_TOP, PILL_H = 1176, 70  # bottom 1246 < META_SAFE_BOTTOM
assert CAP_TOP + CAP_H <= PILL_TOP and PILL_TOP + PILL_H <= META_SAFE_BOTTOM

cap_css = f"""
#root {{ position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; }}
.cg {{ position:absolute; left:100px; right:100px; top:{CAP_TOP}px; height:{CAP_H}px; display:flex; flex-wrap:wrap; justify-content:center; align-content:flex-end;
      gap:0 14px; text-align:center; opacity:0; will-change:transform; overflow:visible; }}
.cw {{ display:inline-block; font-size:54px; font-weight:800; line-height:1.18; color:#fff; letter-spacing:-0.005em; will-change:transform;
      text-shadow:0 3px 0 rgba(15,26,46,0.92), 0 0 2px rgba(15,26,46,0.92), 0 0 18px rgba(15,26,46,0.6); }}
"""
cap_body, cap_js = [], []
for gi, g in enumerate(GROUPS):
    spans = "".join(f'<span class="cw" id="cw-{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    cap_body.append(f'<div class="cg" id="cg-{gi}">{spans}</div>')
    s, e = g["start"], g["end"]
    cap_js.append(f'tl.fromTo("#cg-{gi}", {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }}, {s:.3f});')
    for wi, w in enumerate(g["words"]):
        ws = max(s, w["start"])
        we = g["words"][wi + 1]["start"] if wi + 1 < len(g["words"]) else e
        if we <= ws:
            we = ws + 0.05
        d_on = round(min(0.07, (we - ws) * 0.9), 3)
        cap_js.append(f'tl.fromTo("#cw-{gi}-{wi}", {{ color: "#ffffff" }}, {{ color: "#F5B335", duration: {d_on}, ease: "none" }}, {ws:.3f});')
        cap_js.append(f'tl.to("#cw-{gi}-{wi}", {{ color: "#ffffff", duration: 0.07, ease: "none" }}, {we:.3f});')
    x0 = max(s + 0.13, e - 0.1)
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

# ---- pills (cues in SOURCE seconds) ----------------------------------------------
card_css = f"""
#root {{ position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; color:#fff; }}
.pillrow {{ position:absolute; left:80px; right:80px; top:{PILL_TOP}px; height:{PILL_H}px; display:flex; justify-content:center; align-items:center; }}
.pill {{ display:inline-flex; align-items:center; gap:14px; background:rgba(15,26,46,0.92); border-radius:999px; padding:13px 28px; font-size:32px; font-weight:800;
        letter-spacing:0.01em; will-change:transform; opacity:0; transform-origin:50% 50%; box-shadow:0 12px 30px rgba(15,26,46,0.3); white-space:nowrap; }}
.pill b {{ color:#F5B335; font-weight:900; }}
.dot {{ width:9px; height:9px; border-radius:50%; background:#F5B335; display:inline-block; flex:none; }}
.old {{ position:relative; display:inline-block; color:rgba(255,255,255,0.75); }}
.strike {{ position:absolute; left:-4px; right:-4px; top:52%; height:5px; border-radius:3px; background:#E2483D; transform-origin:0% 50%; transform:scaleX(0); will-change:transform; }}
.new {{ display:none; color:#F5B335; font-weight:900; opacity:0; will-change:transform; transform-origin:0% 50%; }}
  .it {{ opacity:0; display:none; will-change:transform; }}
.arrow {{ display:inline-block; width:0; height:0; border-left:13px solid transparent; border-right:13px solid transparent; border-top:17px solid #F5B335; margin-left:2px; will-change:transform; }}
"""


def card(cid, src_a, src_b, inner, extra=lambda L: ""):
    o0, o1 = to_out(src_a), to_out(src_b, "prev")
    dur = round(o1 - o0, 3)
    L = lambda src_t: max(0.0, round(to_out(src_t) - o0, 3))  # scene-local time of a source cue
    body = f'<div class="pillrow"><div class="pill" id="{cid}-p">{inner}</div></div>'
    js = (f'tl.fromTo("#{cid}-p", {{ opacity: 0, scale: 0.9, y: 14 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power3.out" }}, 0);\n'
          + extra(L)
          + f'tl.to("#{cid}-p", {{ opacity: 0, y: 10, duration: 0.22, ease: "power2.in" }}, {max(0, dur - 0.24):.3f});\n')
    open(f"compositions/{cid}.html", "w").write(sub_file(cid, card_css, body, js))
    return dict(cid=cid, start=o0, dur=dur)


hosts = [
    # hook: the $10,000 quote appears as he says it
    card("card-quote", 2.56, 9.12, '<span>Tradie charged</span><b>$10,000</b><span>for a website</span>'),
    # the offer: $10,000 struck through, $500 lands on "500"
    card("card-price", 9.40, 13.84,
         '<span class="old" id="card-price-old">$10,000<span class="strike" id="card-price-s"></span></span>'
         '<span class="new" id="card-price-new">$500</span><span>pay after you see it</span>',
         lambda L: (f'tl.fromTo("#card-price-s", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.22, ease: "power2.out" }}, {L(10.16):.3f});\n'
                    f'tl.set("#card-price-new", {{ display: "inline-block" }}, {L(10.32):.3f});\n'
                    f'tl.fromTo("#card-price-new", {{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" }}, {L(10.32):.3f});\n')),
    # what it does: items land as he names them
    card("card-does", 18.00, 22.48,
         '<span class="it" id="card-does-a">Shows on Google</span><span class="dot it" id="card-does-d1"></span>'
         '<span class="it" id="card-does-b">Google Ads</span><span class="dot it" id="card-does-d2"></span>'
         '<span class="it" id="card-does-c">Reviews</span>',
         lambda L: (f'tl.set("#card-does-a", {{ display: "inline-block" }}, {L(18.08):.3f});\n'
                    f'tl.set(["#card-does-d1", "#card-does-b"], {{ display: "inline-block" }}, {L(19.20):.3f});\n'
                    f'tl.set(["#card-does-d2", "#card-does-c"], {{ display: "inline-block" }}, {L(21.52):.3f});\n'
                    f'tl.fromTo("#card-does-a", {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: "power3.out" }}, {L(18.08):.3f});\n'
                    f'tl.fromTo(["#card-does-d1", "#card-does-b"], {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: "power3.out" }}, {L(19.20):.3f});\n'
                    f'tl.fromTo(["#card-does-d2", "#card-does-c"], {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: "power3.out" }}, {L(21.52):.3f});\n')),
    card("card-cta", 23.93, 28.80, '<b>Free demo</b><span>fill out the form below</span><span class="arrow" id="card-cta-a"></span>',
         lambda L: 'tl.fromTo("#card-cta-a", { y: -4 }, { y: 6, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 7 }, 0.35);\n'),
]

# ---- index.html -------------------------------------------------------------------
vids, tlines = [], []
for i, sg in enumerate(segs):
    vids.append(f'      <video id="v{i}" class="clip" src="{SRC}" muted playsinline data-start="{sg["out_in"]:.3f}" '
                f'data-duration="{sg["out_out"] - sg["out_in"]:.3f}" data-media-start="{sg["src_in"]:.3f}" data-track-index="0"></video>')
    sc = BASE_SCALE * (1.0 if i % 2 == 0 else PUNCH)
    tlines.append(f'      tl.set("#video-wrap", {{ scale: {sc:.3f}, x: {TX}, y: {TY} }}, {sg["out_in"]:.3f});')
tlines.append(f'      tl.set({{}}, {{}}, {TOTAL:.3f});')
card_hosts = "\n".join(
    f'      <div id="{h["cid"]}-host" data-composition-id="{h["cid"]}" data-composition-src="compositions/{h["cid"]}.html" '
    f'data-start="{h["start"]:.3f}" data-duration="{h["dur"]:.3f}" data-track-index="2" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>'
    for h in hosts)

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>$500 website Meta ad</title>
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
{chr(10).join(tlines)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
json.dump({"segments": segs, "total": TOTAL, "cards": hosts, "caption_groups": len(GROUPS)}, open("edl.json", "w"), indent=1)
print(f"total {TOTAL}s, {len(GROUPS)} caption groups, {len(hosts)} cards")
for h in hosts:
    print(f"  {h['cid']:14s} {h['start']:6.2f} +{h['dur']:.2f}")
for g in GROUPS:
    print(f"  {g['start']:6.2f}-{g['end']:6.2f}  " + " ".join(w['text'] for w in g['words']))
