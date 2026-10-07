#!/usr/bin/env python3
"""Generate the HyperFrames composition for the bike video edit.

Reads transcript.json (word timings in SOURCE time), applies the edit decision
list (kept source ranges), and writes index.html plus compositions/*.html.
All overlay cues are authored in SOURCE seconds and mapped to output time here.
"""
import json, html, os

W, H = 1080, 1920
SRC = "assets/bike.mp4"
FPS = 30

# ---- Edit decision list: kept source ranges (seconds) -------------------------
EDL = [
    (0.55, 7.90),     # hook
    (10.20, 29.95),   # connectors + gmail scan (drops 2.3s dead air)
    (36.86, 58.65),   # CRM ranking (drops mumble + "put it into a big," restart)
    (61.20, 66.66),   # "Secondly..." (tightens pause after "It's crap.")
    (67.62, 70.56),   # drops "about the cosmic," restart
    (72.04, 117.10),  # drops "into a threading code."
    (123.30, 126.30), # "Happy birthday Susan. 45 never looks so good." (drops "um f*** it")
    (128.30, 134.00), # "Trust me..." (drops "f***ing something bullshit" + CapCut tail)
]
END_CARD = 2.4  # seconds of closing card after the last segment

segs = []
t = 0.0
for a, b in EDL:
    segs.append({"src_in": a, "src_out": b, "out_in": t, "out_out": t + (b - a)})
    t += b - a
TALK_END = round(t, 3)
TOTAL = round(TALK_END + END_CARD, 3)


def to_out(s, snap="next"):
    """Map a source time to output time. If it falls in a cut, snap to the next
    kept range start (snap='next') or previous kept range end (snap='prev')."""
    for sg in segs:
        if sg["src_in"] <= s <= sg["src_out"]:
            return round(sg["out_in"] + (s - sg["src_in"]), 3)
    if snap == "next":
        for sg in segs:
            if s < sg["src_in"]:
                return sg["out_in"]
        return TALK_END
    for sg in reversed(segs):
        if s > sg["src_out"]:
            return sg["out_out"]
    return 0.0


def kept(s):
    return any(sg["src_in"] <= s <= sg["src_out"] for sg in segs)


# ---- Captions ------------------------------------------------------------------
FIX = {"woman,": "when,", "autoplay": "AutoPlay"}
words = []
for w in json.load(open("transcript.json")):
    mid = (w["start"] + w["end"]) / 2
    if not kept(mid):
        continue
    txt = FIX.get(w["text"], w["text"])
    words.append({"text": txt, "start": to_out(w["start"]), "end": to_out(w["end"], "prev")})

groups, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    sent_end = w["text"][-1:] in ".?!"
    comma = w["text"][-1:] == ","
    gap = (nxt["start"] - w["end"]) if nxt else 9
    if nxt is None or len(cur) >= 4 or sent_end or (comma and len(cur) >= 2) or gap > 0.45:
        groups.append(cur)
        cur = []
GROUPS = []
for gi, g in enumerate(groups):
    start = g[0]["start"]
    nxt_start = groups[gi + 1][0]["start"] if gi + 1 < len(groups) else TALK_END
    end = min(g[-1]["end"] + 0.35, nxt_start - 0.04, TALK_END)
    GROUPS.append({"start": start, "end": round(end, 3), "words": g})

# ---- Cards (cues in SOURCE seconds) -------------------------------------------
GOLD, NAVY, BLUE, INK = "#EFA41E", "#0F1A2E", "#0077C0", "#1B2026"

CARDS = [
    dict(id="hook", src=(0.60, 7.60), kind="hook",
         kicker="IF I STILL SOLD CARS", words=[("HOW", 0.6), ("I'D", 0.75), ("USE", 0.9), ("AI", 1.05), ("TO GET AHEAD", 1.25)]),
    dict(id="connect", src=(11.00, 19.60), kind="chips", kicker="STEP 1 · CONNECT",
         items=[("Claude", 11.0), ("Gmail", 12.9), ("Google Sheets", 15.2)]),
    dict(id="scan", src=(23.60, 29.90), kind="list", kicker="SCAN YOUR GMAIL", title="Every inquiry you've ever had",
         items=[("How many times you spoke", 25.9), ("What car they wanted", 28.3)]),
    dict(id="rank", src=(40.00, 51.60), kind="list", kicker="CLAUDE RANKS THE LIST", title="One big CRM, sorted for you",
         items=[("Priority", 45.4), ("Worth flagging", 47.1), ("Interested", 48.6), ("Follow up now", 50.0)]),
    dict(id="crm", src=(52.00, 58.60), kind="slam",
         lines=[("A FULL CRM", 52.5), ("$0 SOFTWARE", 54.4)]),
    dict(id="thread", src=(63.90, 70.50), kind="list", kicker="STEP 2 · EVERY SALE", title="One thread per customer",
         items=[("The contract", 64.9), ("A few notes about them", 67.7)]),
    dict(id="sheet", src=(80.00, 85.70), kind="table", kicker="MASTER GOOGLE SHEET",
         rows=[("Susan", "Mitsubishi Triton", "Jul 26", 81.4), ("Mike", "Ford Ranger", "Aug 26", 82.6), ("Priya", "Toyota RAV4", "Sep 26", 83.8)]),
    dict(id="routine", src=(85.90, 102.60), kind="timeline", kicker="STEP 3 · ROUTINE", title="Checks the sheet for you",
         nodes=[("3M", 94.4), ("6M", 96.3), ("9M", 97.5), ("12M", 98.5)], tail=("Sends the email for you", 100.0)),
    dict(id="email", src=(102.80, 114.10), kind="email",
         lines=[("Hey Susan, it's been 3 months since you bought your car.", 102.9),
                ("Hope you're absolutely loving her.", 105.7),
                ("It's getting into winter now, bloody cold out here.", 107.4),
                ("Hope the Triton is serving you well.", 111.3)]),
    dict(id="birthday", src=(114.30, 126.30), kind="list", kicker="BIRTHDAYS TOO", title="Happy birthday, Susan",
         items=[("45 never looked so good", 124.6)]),
    dict(id="close", src=(129.70, 134.00), kind="slam",
         lines=[("MORE CLIENTS.", 130.8), ("ZERO EXTRA WORK.", 132.2)]),
]

COMMON_CSS = """
#root { position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; color:#fff; }
.zone { position:absolute; left:80px; right:80px; top:960px; height:300px; display:flex; align-items:flex-end; }
.card { width:100%; background: rgba(15,26,46,0.94); border-radius:28px; padding:34px 42px; box-sizing:border-box;
        box-shadow:0 24px 60px rgba(15,26,46,0.28); transform-origin:50% 100%; will-change:transform; }
.kicker { font-size:26px; font-weight:700; letter-spacing:0.16em; color:#EFA41E; margin-bottom:12px; }
.title { font-size:48px; font-weight:900; line-height:1.08; letter-spacing:-0.01em; }
.items { display:flex; flex-wrap:wrap; gap:14px; margin-top:20px; }
.item { display:inline-flex; align-items:center; gap:12px; background:rgba(255,255,255,0.08); border:2px solid rgba(239,164,30,0.55);
        border-radius:999px; padding:12px 22px; font-size:30px; font-weight:700; transform-origin:0% 50%; will-change:transform; opacity:0; }
.item .tick { width:26px; height:26px; border-radius:50%; background:#EFA41E; display:inline-block; position:relative; flex:none; }
.item .tick::after { content:""; position:absolute; left:8px; top:3px; width:7px; height:13px; border:solid #0F1A2E; border-width:0 4px 4px 0; transform:rotate(45deg); }
.chips { display:flex; align-items:center; gap:16px; margin-top:16px; flex-wrap:wrap; }
.chip { background:#fff; color:#0F1A2E; border-radius:18px; padding:16px 26px; font-size:36px; font-weight:900; transform-origin:50% 50%; will-change:transform; opacity:0; }
.plus { font-size:40px; font-weight:900; color:#EFA41E; opacity:0; }
.slam { position:absolute; left:80px; right:80px; top:960px; height:300px; display:flex; flex-direction:column; justify-content:flex-end; gap:6px; }
.slam .line { font-size:92px; font-weight:900; line-height:1; letter-spacing:-0.02em; color:#fff; opacity:0; transform-origin:0% 100%; will-change:transform;
              text-shadow:0 6px 0 #0F1A2E, 0 0 28px rgba(15,26,46,0.6); }
.slam .line.gold { color:#EFA41E; }
.table { margin-top:18px; border-radius:16px; overflow:hidden; background:#fff; color:#0F1A2E; font-family:Inter, sans-serif; }
.tr { display:grid; grid-template-columns:1.1fr 1.9fr 1fr; padding:12px 18px; font-size:27px; font-weight:400; border-top:2px solid #E5EBF2; }
.tr.head { background:#EFA41E; color:#0F1A2E; font-weight:700; font-size:22px; letter-spacing:0.08em; border-top:0; }
.tr.row { opacity:0; transform-origin:0% 50%; will-change:transform; }
.tl { position:relative; margin-top:30px; height:70px; }
.tl .bar { position:absolute; left:0; right:0; top:14px; height:10px; border-radius:5px; background:rgba(255,255,255,0.15); overflow:hidden; }
.tl .fill { position:absolute; left:0; top:0; width:100%; height:100%; background:#EFA41E; transform-origin:0% 50%; transform:scaleX(0); will-change:transform; }
.tl .node { position:absolute; top:0; width:38px; height:38px; margin-left:-19px; border-radius:50%; background:#0F1A2E; border:5px solid rgba(255,255,255,0.25);
            box-sizing:border-box; transform-origin:50% 50%; will-change:transform; }
.tl .lab { position:absolute; top:46px; font-size:24px; font-weight:700; letter-spacing:0.06em; transform:translateX(-50%); color:rgba(255,255,255,0.55); }
.tail { margin-top:10px; font-size:30px; font-weight:700; color:#EFA41E; opacity:0; transform-origin:0% 50%; will-change:transform; }
.mail { width:100%; background:#fff; color:#1B2026; border-radius:24px; padding:30px 36px; box-sizing:border-box; font-family:Inter, sans-serif;
        box-shadow:0 24px 60px rgba(15,26,46,0.28); transform-origin:50% 100%; will-change:transform; }
.mail .hdr { display:flex; align-items:center; gap:14px; font-size:24px; color:#4A5A6C; margin-bottom:14px; }
.mail .av { width:40px; height:40px; border-radius:50%; background:#EFA41E; flex:none; }
.mail .hdr b { color:#1B2026; }
.mail .ln { font-size:31px; line-height:1.3; font-weight:400; opacity:0; transform-origin:0% 50%; will-change:transform; margin:0 0 6px; }
.hookwrap { position:absolute; left:80px; right:80px; top:960px; height:300px; display:flex; flex-direction:column; justify-content:flex-end; }
.hookwrap .kicker { opacity:0; display:inline-block; align-self:flex-start; background:#0F1A2E; color:#EFA41E; padding:10px 18px; border-radius:12px; margin-bottom:18px; }
.hookwrap .w { display:inline-block; font-size:88px; font-weight:900; line-height:1; letter-spacing:-0.02em; margin-right:22px; opacity:0; will-change:transform;
               text-shadow:0 6px 0 #0F1A2E, 0 0 28px rgba(15,26,46,0.6); }
.hookwrap .w.gold { color:#EFA41E; }
"""


def esc(s):
    return html.escape(s, quote=True)


def sub_file(cid, body, js, extra_css=""):
    return f"""<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>{cid}</title></head>
  <body>
    <template>
      <style>{COMMON_CSS}{extra_css}</style>
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


POP = 'tl.fromTo("{sel}", {{ opacity: 0, scale: 0.6, y: 18 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "power3.out" }}, {t:.3f});\n'
CARD_IN = 'tl.fromTo("#{cid}-card", {{ opacity: 0, scale: 0.92, y: 40 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out" }}, 0);\n'


def card_out(cid, dur, sel=None):
    sel = sel or f"#{cid}-card"
    return f'tl.to("{sel}", {{ opacity: 0, y: -24, duration: 0.28, ease: "power2.in" }}, {max(0.0, dur - 0.3):.3f});\n'


def build_card(c):
    cid = "card-" + c["id"]
    o0 = to_out(c["src"][0])
    o1 = to_out(c["src"][1], "prev")
    dur = round(o1 - o0, 3)

    def L(src_t):  # scene-local time for a source cue
        return max(0.0, round(to_out(src_t) - o0, 3))

    k = c["kind"]
    js, body = "", ""
    if k == "hook":
        ws = "".join(f'<span class="w{" gold" if i == len(c["words"]) - 1 else ""}" id="{cid}-w{i}">{esc(t)}</span>' for i, (t, _) in enumerate(c["words"]))
        body = f'<div class="hookwrap" id="{cid}-card"><div class="kicker" id="{cid}-k">{esc(c["kicker"])}</div><div>{ws}</div></div>'
        js += f'tl.fromTo("#{cid}-k", {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, 0.05);\n'
        # waterfall-entry: binary reveal + whip from below, overlapping
        for i, (t, src_t) in enumerate(c["words"]):
            at = L(src_t)
            y = 80 if i == 0 else 48
            d = 0.18 if i == 0 else 0.15
            js += f'tl.set("#{cid}-w{i}", {{ opacity: 1, y: {y} }}, {at:.3f});\n'
            js += f'tl.to("#{cid}-w{i}", {{ y: 0, duration: {d}, ease: "power4.out" }}, {at:.3f});\n'
        js += card_out(cid, dur)
    elif k == "chips":
        parts = []
        for i, (t, _) in enumerate(c["items"]):
            if i:
                parts.append(f'<span class="plus" id="{cid}-p{i}">+</span>')
            parts.append(f'<span class="chip" id="{cid}-c{i}">{esc(t)}</span>')
        body = f'<div class="zone"><div class="card" id="{cid}-card"><div class="kicker">{esc(c["kicker"])}</div><div class="chips">{"".join(parts)}</div></div></div>'
        js += CARD_IN.format(cid=cid)
        for i, (t, src_t) in enumerate(c["items"]):
            at = L(src_t)
            if i:
                js += f'tl.fromTo("#{cid}-p{i}", {{ opacity: 0, scale: 0.4 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" }}, {max(0, at - 0.12):.3f});\n'
            js += POP.format(sel=f"#{cid}-c{i}", t=at)
        js += card_out(cid, dur)
    elif k == "list":
        items = "".join(f'<span class="item" id="{cid}-i{i}"><span class="tick"></span>{esc(t)}</span>' for i, (t, _) in enumerate(c["items"]))
        body = f'<div class="zone"><div class="card" id="{cid}-card"><div class="kicker">{esc(c["kicker"])}</div><div class="title">{esc(c["title"])}</div><div class="items">{items}</div></div></div>'
        js += CARD_IN.format(cid=cid)
        for i, (t, src_t) in enumerate(c["items"]):
            js += POP.format(sel=f"#{cid}-i{i}", t=L(src_t))
        js += card_out(cid, dur)
    elif k == "slam":
        lines = "".join(f'<div class="line{" gold" if i else ""}" id="{cid}-l{i}">{esc(t)}</div>' for i, (t, _) in enumerate(c["lines"]))
        body = f'<div class="slam" id="{cid}-card">{lines}</div>'
        for i, (t, src_t) in enumerate(c["lines"]):
            at = L(src_t)
            js += f'tl.fromTo("#{cid}-l{i}", {{ opacity: 0, scale: 1.35, x: -30 }}, {{ opacity: 1, scale: 1, x: 0, duration: 0.22, ease: "power4.out" }}, {at:.3f});\n'
        js += card_out(cid, dur)
    elif k == "table":
        rows = "".join(f'<div class="tr row" id="{cid}-r{i}"><span>{esc(a)}</span><span>{esc(b)}</span><span>{esc(d)}</span></div>' for i, (a, b, d, _) in enumerate(c["rows"]))
        body = (f'<div class="zone"><div class="card" id="{cid}-card"><div class="kicker">{esc(c["kicker"])}</div>'
                f'<div class="table"><div class="tr head"><span>CUSTOMER</span><span>CAR</span><span>SOLD</span></div>{rows}</div></div></div>')
        js += CARD_IN.format(cid=cid)
        for i, (_, _, _, src_t) in enumerate(c["rows"]):
            at = L(src_t)
            js += f'tl.fromTo("#{cid}-r{i}", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.32, ease: "power3.out" }}, {at:.3f});\n'
        js += card_out(cid, dur)
    elif k == "timeline":
        n = len(c["nodes"])
        nodes = "".join(
            f'<div class="node" id="{cid}-n{i}" style="left:{(i + 0.5) / n * 100:.1f}%"></div><div class="lab" id="{cid}-b{i}" style="left:{(i + 0.5) / n * 100:.1f}%">{esc(t)}</div>'
            for i, (t, _) in enumerate(c["nodes"]))
        body = (f'<div class="zone"><div class="card" id="{cid}-card"><div class="kicker">{esc(c["kicker"])}</div><div class="title">{esc(c["title"])}</div>'
                f'<div class="tl"><div class="bar"><div class="fill" id="{cid}-fill"></div></div>{nodes}</div>'
                f'<div class="tail" id="{cid}-tail">{esc(c["tail"][0])}</div></div></div>')
        js += CARD_IN.format(cid=cid)
        js += f'tl.set("#{cid}-fill", {{ scaleX: 0 }}, 0);\n'
        for i, (t, src_t) in enumerate(c["nodes"]):
            at = L(src_t)
            frac = (i + 0.5) / n
            js += f'tl.to("#{cid}-fill", {{ scaleX: {frac:.3f}, duration: 0.35, ease: "power2.out" }}, {max(0, at - 0.3):.3f});\n'
            js += f'tl.fromTo("#{cid}-n{i}", {{ scale: 1, backgroundColor: "#0F1A2E", borderColor: "rgba(255,255,255,0.25)" }}, {{ scale: 1.25, backgroundColor: "#EFA41E", borderColor: "#EFA41E", duration: 0.3, ease: "power3.out" }}, {at:.3f});\n'
            js += f'tl.fromTo("#{cid}-b{i}", {{ color: "rgba(255,255,255,0.55)" }}, {{ color: "#ffffff", duration: 0.3 }}, {at:.3f});\n'
        js += POP.format(sel=f"#{cid}-tail", t=L(c["tail"][1]))
        js += card_out(cid, dur)
    elif k == "email":
        lines = "".join(f'<p class="ln" id="{cid}-l{i}">{esc(t)}</p>' for i, (t, _) in enumerate(c["lines"]))
        body = (f'<div class="zone"><div class="mail" id="{cid}-card"><div class="hdr"><span class="av"></span><span>From <b>Joe, your sales guy</b> · 3 months later</span></div>{lines}</div></div>')
        js += CARD_IN.format(cid=cid)
        for i, (t, src_t) in enumerate(c["lines"]):
            js += f'tl.fromTo("#{cid}-l{i}", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {L(src_t):.3f});\n'
        js += card_out(cid, dur)
    with open(f"compositions/{cid}.html", "w") as f:
        f.write(sub_file(cid, body, js))
    return dict(cid=cid, start=o0, dur=dur)


hosts = [build_card(c) for c in CARDS]

# ---- Captions sub-composition -------------------------------------------------
cap_css = """
#root { position:absolute; inset:0; font-family: Montserrat, Inter, sans-serif; }
.cg { position:absolute; left:90px; right:90px; top:1300px; height:190px; display:flex; flex-wrap:wrap; justify-content:center; align-content:flex-start;
      gap:0 18px; text-align:center; opacity:0; transform-origin:50% 50%; will-change:transform; overflow:visible; }
.cw { display:inline-block; font-size:62px; font-weight:900; line-height:1.15; text-transform:uppercase; color:#fff; letter-spacing:-0.01em;
      transform-origin:50% 60%; will-change:transform;
      text-shadow:0 4px 0 #0F1A2E, -3px 0 0 #0F1A2E, 3px 0 0 #0F1A2E, 0 -3px 0 #0F1A2E, 0 0 22px rgba(15,26,46,0.55); }
"""
cap_body, cap_js = [], []
for gi, g in enumerate(GROUPS):
    spans = "".join(f'<span class="cw" id="cw-{gi}-{wi}">{esc(w["text"])}</span>' for wi, w in enumerate(g["words"]))
    cap_body.append(f'<div class="cg" id="cg-{gi}">{spans}</div>')
    s, e = g["start"], g["end"]
    cap_js.append(f'tl.fromTo("#cg-{gi}", {{ opacity: 0, scale: 0.9, y: 14 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.14, ease: "power3.out" }}, {s:.3f});')
    for wi, w in enumerate(g["words"]):
        ws = max(s, w["start"])
        we = g["words"][wi + 1]["start"] if wi + 1 < len(g["words"]) else e
        if we <= ws:
            we = ws + 0.05
        d_on = round(min(0.09, (we - ws) * 0.9), 3)
        cap_js.append(f'tl.fromTo("#cw-{gi}-{wi}", {{ color: "#ffffff", scale: 1 }}, {{ color: "#EFA41E", scale: 1.1, duration: {d_on}, ease: "power2.out" }}, {ws:.3f});')
        cap_js.append(f'tl.to("#cw-{gi}-{wi}", {{ color: "#ffffff", scale: 1, duration: 0.09, ease: "power2.out" }}, {we:.3f});')
    x0 = max(s + 0.15, e - 0.1)
    cap_js.append(f'tl.to("#cg-{gi}", {{ opacity: 0, scale: 0.96, duration: {max(0.02, round(e - x0, 3))}, ease: "power2.in" }}, {x0:.3f});')
    cap_js.append(f'tl.set("#cg-{gi}", {{ opacity: 0, visibility: "hidden" }}, {e:.3f});')
cap_js.append(f'tl.set({{}}, {{}}, {TALK_END:.3f});')
with open("compositions/captions.html", "w") as f:
    f.write(f"""<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>captions</title></head>
  <body>
    <template>
      <style>{cap_css}</style>
      <div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}">
{chr(10).join(cap_body)}
      </div>
      <script>
        (function () {{
          const tl = gsap.timeline({{ paused: true }});
{chr(10).join(cap_js)}
          window.__timelines["captions"] = tl;
        }})();
      </script>
    </template>
  </body>
</html>
""")

# ---- End card -------------------------------------------------------------------
with open("compositions/endcard.html", "w") as f:
    f.write(f"""<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>endcard</title></head>
  <body>
    <template>
      <style>
        #root {{ position:absolute; inset:0; background:#0F1A2E; font-family: Montserrat, Inter, sans-serif; color:#fff;
                display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; overflow:hidden; }}
        #ec-glow {{ position:absolute; width:1400px; height:1400px; left:-160px; top:260px; border-radius:50%;
                   background:radial-gradient(circle, rgba(239,164,30,0.28) 0%, rgba(239,164,30,0) 62%); transform-origin:50% 50%; will-change:transform; }}
        #ec-mark {{ position:relative; font-size:120px; font-weight:900; letter-spacing:0.02em; line-height:1; transform-origin:50% 50%; will-change:transform; }}
        #ec-mark b {{ color:#EFA41E; }}
        #ec-url {{ position:relative; font-family:Inter, sans-serif; font-size:40px; font-weight:400; color:rgba(255,255,255,0.8); letter-spacing:0.04em; }}
      </style>
      <div id="root" data-composition-id="endcard" data-width="{W}" data-height="{H}">
        <div id="ec-glow"></div>
        <div id="ec-mark">LEAD<b>HIVE</b></div>
        <div id="ec-url">leadhivenz.com</div>
      </div>
      <script>
        (function () {{
          const tl = gsap.timeline({{ paused: true }});
          tl.fromTo("#ec-glow", {{ scale: 0.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 1.2, ease: "power2.out" }}, 0);
          tl.fromTo("#ec-mark", {{ opacity: 0, scale: 0.8 }}, {{ opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }}, 0.1);
          tl.fromTo("#ec-url", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }}, 0.45);
          window.__timelines["endcard"] = tl;
        }})();
      </script>
    </template>
  </body>
</html>
""")

# ---- index.html ------------------------------------------------------------------
vids = []
for i, sg in enumerate(segs):
    vids.append(f'      <video id="v{i}" class="clip" src="{SRC}" playsinline data-has-audio="true" data-start="{sg["out_in"]:.3f}" '
                f'data-duration="{sg["out_out"] - sg["out_in"]:.3f}" data-media-start="{sg["src_in"]:.3f}" data-track-index="0"></video>')
card_hosts = "\n".join(
    f'      <div id="{h["cid"]}-host" data-composition-id="{h["cid"]}" data-composition-src="compositions/{h["cid"]}.html" '
    f'data-start="{h["start"]:.3f}" data-duration="{h["dur"]:.3f}" data-track-index="2" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>'
    for h in hosts)
punch = []
for i, sg in enumerate(segs):
    sc = 1.12 if i % 2 == 0 else 1.19
    punch.append(f'      tl.set("#video-wrap", {{ scale: {sc}, y: -70 }}, {sg["out_in"]:.3f});')
punch.append(f'      tl.set({{}}, {{}}, {TOTAL:.3f});')

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>How I'd use AI if I still sold cars</title>
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
{card_hosts}
      <div id="captions-host" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TALK_END:.3f}" data-track-index="1" data-track-kind="captions" data-width="{W}" data-height="{H}"></div>
      <div id="endcard-host" data-composition-id="endcard" data-composition-src="compositions/endcard.html" data-start="{TALK_END:.3f}" data-duration="{END_CARD:.3f}" data-track-index="3" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(punch)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)

# ---- Report ----------------------------------------------------------------------
json.dump({"segments": segs, "talk_end": TALK_END, "total": TOTAL, "cards": hosts, "caption_groups": len(GROUPS)}, open("edl.json", "w"), indent=1)
print(f"talk {TALK_END}s, total {TOTAL}s, {len(GROUPS)} caption groups, {len(hosts)} cards")
for h in hosts:
    print(f"  {h['cid']:16s} {h['start']:7.2f} +{h['dur']:.2f}")
