#!/usr/bin/env python3
"""HostFix "how it works": animation layer only, rendered with transparency and composited onto the
untouched original (no cuts, no zoom, audio copied). Times are source seconds from transcript.json.
Graphics live in the sky (y 250-560) and the chest area (y 1380-1560) so the face is never covered."""
import json, html

W, H, TOTAL = 1080, 1920, 45.567
PLUM, PLUM2, LIME, CREAM = "#2B1631", "#3A2142", "#D7EC4C", "#F5F2EA"
F = "'Montserrat', sans-serif"
words = json.load(open("transcript.json"))
def t(word, nth=0, after=0.0):
    hits = [w["start"] for w in words if w["text"].lower().strip(",.?") == word.lower() and w["start"] >= after]
    return hits[nth]
def T(x): return f"{x:.3f}"
esc = lambda s: html.escape(s, quote=True)

ICON = {
    "door": '<svg viewBox="0 0 24 24"><path d="M5 3h10v18H5z" fill="currentColor"/><path d="M15 5l4 1.5v12L15 20z" fill="#D7EC4C"/><circle cx="12.5" cy="12" r="1.2" fill="#D7EC4C"/></svg>',
    "wrench": '<svg viewBox="0 0 24 24"><path d="M20.5 6.5a5 5 0 0 1-6.6 6.6L7 20l-3-3 6.9-6.9a5 5 0 0 1 6.6-6.6L14 7l3 3z" fill="currentColor"/></svg>',
    "home": '<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="currentColor"/></svg>',
    "check": '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "tag": '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" fill="currentColor"/><circle cx="7.5" cy="8" r="1.8" fill="#2B1631"/></svg>',
    "clock": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    "shield": '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="currentColor"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#2B1631" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "user": '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>',
    "send": '<svg viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-8z" fill="currentColor"/></svg>',
    "down": '<svg viewBox="0 0 24 24"><path d="M12 4v14M5 12l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "bell": '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0" fill="currentColor"/></svg>',
}
html_parts, js = [], []
def ic(name, cls=""): return f'<i class="{cls}">{ICON[name]}</i>'
def enter(sel, at, dy=24, dur=0.45, dx=0):
    js.append(f'tl.fromTo("{sel}", {{ opacity: 0, y: {dy}, x: {dx} }}, {{ opacity: 1, y: 0, x: 0, duration: {dur}, ease: "power2.out" }}, {T(at)});')
def leave(sel, at, dur=0.35):
    js.append(f'tl.to("{sel}", {{ opacity: 0, y: -12, duration: {dur}, ease: "power1.in" }}, {T(at - dur)});')
    js.append(f'tl.set("{sel}", {{ visibility: "hidden" }}, {T(at)});')
def group(gid, inner, at_out, top=270, extra=""):
    html_parts.append(f'<div class="zone" id="{gid}" style="top:{top}px;{extra}">{inner}</div>')
    leave(f"#{gid}", at_out)

# 1. what is HostFix? (wordmark)
g1_out = t("connects") - 0.05
group("g1", f'<div class="mark" id="m1">{ic("door","dr")}<span>HostFix</span></div><div class="sub" id="m2">How it works</div>', g1_out)
enter("#m1", t("hostfix") - 0.25, 30, 0.6)
enter("#m2", t("hostfix") + 0.2)

# 2. connects tradies with Airbnb owners, fixed prices
g2_out = t("you") - 0.05
group("g2", f'<div class="link"><div class="node" id="n1">{ic("wrench")}Tradies</div><div class="wire"><b id="wire"></b></div>'
            f'<div class="node lime" id="n2">{ic("home")}Airbnb owners</div></div><div class="pill lime" id="fp">{ic("tag")}Fixed prices</div>', g2_out)
enter("#n1", t("tradesmen") - 0.1, 0, 0.45, -40)
js.append(f'tl.fromTo("#wire", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.6, ease: "power2.inOut" }}, {T(t("with") - 0.05)});')
enter("#n2", t("airbnb") - 0.1, 0, 0.45, 40)
enter("#fp", t("fixed") - 0.1)

# 3. set up once: account, lockbox, water main, switchboard, house details
g3_out = t("log") - 0.1
items = [("Create an account", "create"), ("Lockbox code", "lockbox"), ("Water main", "water"), ("Switchboard", "switchboard"), ("House details", "details")]
chips = "".join(f'<div class="chip" id="c{k}">{ic("check","ck")}{esc(n)}</div>' for k, (n, w) in enumerate(items))
group("g3", f'<div class="head" id="h3">SET UP ONCE</div><div class="grid">{chips}</div>', g3_out, top=250)
enter("#h3", t("create") - 0.15)
for k, (n, w) in enumerate(items):
    enter(f"#c{k}", t(w) - 0.1, 18, 0.4)

# 4. log a job -> sent to a tradie, fixed price, accepted within 15 minutes
g4_out = t("the", after=21.0) - 0.05
group("g4", f'<div class="flow"><div class="node lime" id="f1">{ic("send")}Log a job</div><div class="wire"><b id="wire2"></b></div><div class="node" id="f2">{ic("wrench")}Tradie</div></div>'
            f'<div class="row"><div class="pill" id="f3">{ic("tag","lm")}Fixed price</div><div class="pill lime" id="f4">{ic("clock")}Accepted in 15 min</div></div>', g4_out)
enter("#f1", t("log") - 0.1, 0, 0.45, -40)
js.append(f'tl.fromTo("#wire2", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.6, ease: "power2.inOut" }}, {T(t("sent") - 0.05)});')
enter("#f2", t("trade") - 0.2, 0, 0.45, 40)
enter("#f3", t("fixed", after=18.0) - 0.1)
enter("#f4", t("within") - 0.1)

# 5. vetted, insured, know the job
g5_out = t("your", after=26.4) - 0.05
badges = [("shield", "Fully vetted", "vetted"), ("shield", "Public liability insured", "liability"), ("tag", "Clear job & price", "exactly")]
bx = "".join(f'<div class="pill{" lime" if k == 0 else ""}" id="b{k}">{ic(i, "" if k == 0 else "lm")}{esc(n)}</div>' for k, (i, n, w) in enumerate(badges))
group("g5", f'<div class="col">{bx}</div>', g5_out)
for k, (i, n, w) in enumerate(badges):
    enter(f"#b{k}", t(w) - 0.2)

# 6. cleaner or guests can log, with your approval
g6_out = t("the", after=29.9) - 0.05
group("g6", f'<div class="row"><div class="pill" id="d1">{ic("user","lm")}Your cleaner</div><div class="pill" id="d2">{ic("user","lm")}Your guests</div></div>'
            f'<div class="pill lime big" id="d3">{ic("check")}With your approval</div>', g6_out)
enter("#d1", t("cleaner") - 0.1)
enter("#d2", t("guests") - 0.1)
enter("#d3", t("approval") - 0.25)

# 7. confirmed in 15 min, completed in 24 hours
g7_out = t("idea") - 0.15
group("g7", f'<div class="row"><div class="tile" id="e1"><b id="n15">0</b><span>MINUTES<br>CONFIRMED</span></div>'
            f'<div class="tile lime" id="e2"><b id="n24">0</b><span>HOURS<br>COMPLETED</span></div></div>', g7_out)
enter("#e1", t("confirmed") - 0.1)
js.append(f'tl.to("#n15", {{ duration: 0.6, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n15", 15] }}, {T(t("15", after=30) - 0.05)});')
enter("#e2", t("completed") - 0.1)
js.append(f'tl.to("#n24", {{ duration: 0.6, ease: "power2.out", onUpdate: countUp, onUpdateParams: ["#n24", 24] }}, {T(t("24") - 0.05)});')

# 8. for you / for the tradie
g8_out = t("if", after=39.5) - 0.05
group("g8", f'<div class="duo"><div class="side" id="s1"><div class="sh">FOR YOU</div><div class="sl" id="s1a">{ic("check","lm")}Fixed, affordable pricing</div>'
            f'<div class="sl" id="s1b">{ic("check","lm")}Convenience</div></div>'
            f'<div class="side lime" id="s2"><div class="sh">FOR TRADIES</div><div class="sl" id="s2a">{ic("check")}Guaranteed work</div></div></div>', g8_out, top=250)
enter("#s1", t("idea") - 0.05)
enter("#s1a", t("affordable") - 0.1, 12, 0.35)
enter("#s1b", t("convenience") - 0.1, 12, 0.35)
enter("#s2", t("tradie") - 0.1)
enter("#s2a", t("guaranteed") - 0.1, 12, 0.35)

# 9. CTA: link in bio, sign up, first to know at launch
group("g9", f'<div class="mark small" id="k1">{ic("door","dr")}<span>HostFix</span></div>'
            f'<div class="pill lime big" id="k2">{ic("bell")}Sign up · first to know at launch</div>', TOTAL + 1)
enter("#k1", t("interested") - 0.1)
enter("#k2", t("sign") - 0.1)
html_parts.append(f'<div class="cta" id="cta">{ic("down")}LINK IN BIO</div>')
enter("#cta", t("click") - 0.1)
js.append(f'tl.to("#cta i", {{ y: 8, duration: 0.45, repeat: 5, yoyo: true, ease: "sine.inOut" }}, {T(t("click") + 0.4)});')
js.append(f'tl.set({{}}, {{}}, {T(TOTAL)});')

css = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:transparent; }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:transparent; font-family:{F}; }}
.zone {{ position:absolute; left:0; right:0; display:flex; flex-direction:column; align-items:center; gap:16px; }}
i {{ display:inline-flex; width:40px; height:40px; flex:none; }}
i svg {{ width:100%; height:100%; }}
i.lm {{ color:{LIME}; }}
.mark {{ display:flex; align-items:center; gap:18px; padding:20px 40px; border-radius:30px; background:{CREAM}; color:{PLUM}; opacity:0;
  font-weight:800; font-size:84px; letter-spacing:-0.02em; box-shadow:0 18px 44px rgba(0,0,0,0.3); }}
.mark i.dr {{ width:76px; height:76px; color:{PLUM}; }}
.mark.small {{ font-size:60px; padding:14px 32px; }}
.mark.small i.dr {{ width:56px; height:56px; }}
.sub {{ padding:12px 30px; border-radius:999px; background:{PLUM}; color:#fff; font-weight:800; font-size:38px; opacity:0; box-shadow:0 12px 30px rgba(0,0,0,0.3); }}
.link, .flow {{ display:flex; align-items:center; gap:0; }}
.node {{ display:flex; align-items:center; gap:12px; padding:18px 28px; border-radius:24px; background:rgba(43,22,49,0.94); color:#fff;
  font-weight:800; font-size:40px; white-space:nowrap; opacity:0; box-shadow:0 14px 32px rgba(0,0,0,0.3); }}
.node i {{ color:{LIME}; }}
.node.lime {{ background:{LIME}; color:{PLUM}; }}
.node.lime i {{ color:{PLUM}; }}
.wire {{ width:110px; height:8px; margin:0 -4px; position:relative; z-index:0; }}
.wire b {{ display:block; width:100%; height:100%; border-radius:4px; background:{LIME}; transform-origin:0 50%; transform:scaleX(0); box-shadow:0 0 14px rgba(215,236,76,0.6); }}
.pill {{ display:inline-flex; align-items:center; gap:14px; padding:16px 30px; border-radius:999px; background:rgba(43,22,49,0.94); color:#fff;
  font-weight:800; font-size:40px; white-space:nowrap; opacity:0; box-shadow:0 14px 32px rgba(0,0,0,0.3); }}
.pill.lime {{ background:{LIME}; color:{PLUM}; }}
.pill.big {{ font-size:44px; padding:18px 36px; }}
.row {{ display:flex; gap:14px; }}
.col {{ display:flex; flex-direction:column; align-items:center; gap:14px; }}
.head {{ padding:10px 26px; border-radius:999px; background:{LIME}; color:{PLUM}; font-weight:800; font-size:30px; letter-spacing:0.12em; opacity:0; }}
.grid {{ display:flex; flex-wrap:wrap; justify-content:center; gap:12px; width:960px; }}
.chip {{ display:inline-flex; align-items:center; gap:10px; padding:14px 24px; border-radius:20px; background:rgba(43,22,49,0.94); color:#fff;
  font-weight:800; font-size:36px; white-space:nowrap; opacity:0; box-shadow:0 10px 24px rgba(0,0,0,0.3); }}
.chip i.ck {{ width:34px; height:34px; color:{LIME}; }}
.tile {{ display:flex; align-items:center; gap:16px; padding:16px 30px; border-radius:28px; background:rgba(43,22,49,0.94); color:#fff; opacity:0;
  box-shadow:0 16px 36px rgba(0,0,0,0.3); }}
.tile b {{ font-weight:800; font-size:110px; line-height:1; letter-spacing:-0.03em; min-width:126px; text-align:right; color:{LIME}; }}
.tile span {{ font-weight:800; font-size:30px; line-height:1.15; letter-spacing:0.06em; }}
.tile.lime {{ background:{LIME}; color:{PLUM}; }}
.tile.lime b {{ color:{PLUM}; }}
.duo {{ display:flex; gap:16px; align-items:stretch; }}
.side {{ width:452px; padding:22px 26px; border-radius:28px; background:rgba(43,22,49,0.94); color:#fff; opacity:0; box-shadow:0 16px 36px rgba(0,0,0,0.3); }}
.side.lime {{ background:{LIME}; color:{PLUM}; }}
.sh {{ font-weight:800; font-size:28px; letter-spacing:0.14em; opacity:0.85; margin-bottom:10px; }}
.sl {{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:34px; line-height:1.25; margin-top:8px; opacity:0; }}
.sl i {{ width:34px; height:34px; }}
.cta {{ position:absolute; left:0; right:0; margin:0 auto; width:max-content; top:1400px; display:flex; align-items:center; gap:14px; padding:18px 40px;
  border-radius:999px; background:{LIME}; color:{PLUM}; font-weight:800; font-size:48px; letter-spacing:0.04em; opacity:0; box-shadow:0 16px 40px rgba(0,0,0,0.35); }}
.cta i {{ width:46px; height:46px; }}
"""
index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>HostFix how it works overlay</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{T(TOTAL)}">
{chr(10).join('      ' + h for h in html_parts)}
    </div>
    <script>
      function countUp(sel, target) {{ document.querySelector(sel).textContent = Math.round(target * this.progress()); }}
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join('      ' + l for l in js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
print("ok", len(js), "timeline entries")
