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
over.append(f'<div class="btag" id="bt2"><i>{ICON["ig"]}</i>Caravan bar · every job auto-posted to Instagram</div>')
show("#bt1", B1_IN + 0.15, B1_IN + B1_DUR)
show("#bt2", B2_IN + 0.15, B2_IN + B2_DUR)
js.append(f'tl.fromTo("#broll", {{ scale: 1.08 }}, {{ scale: 1.0, duration: {B1_DUR:.3f}, ease: "none" }}, {T(B1_IN)});')
js.append(f'tl.fromTo("#broll", {{ scale: 1.0 }}, {{ scale: 1.08, duration: {B2_DUR:.3f}, ease: "none", immediateRender: false }}, {T(B2_IN)});')

# ------------------------------------------------------------------ 5. websites (seg 7), 14 days (seg 8), refund (seg 9)
s7, s8, s9 = segs[7], segs[8], segs[9]
over.append(f'<div class="top" id="web"><div class="pill gold" id="we1"><i>{ICON["globe"]}</i>New websites built</div></div>')
show("#we1", ts("restructured", 7) - 0.05, s7["out_out"] + 0.05)
over.append(f'<div class="top" id="days"><div class="ctile" id="d1"><div class="cnum" id="n14">0</div><div class="clab">DAYS<br>ONLY</div></div>'
            f'<div class="pill dark" id="d2"><i class="g">{ICON["play"] if "play" in ICON else ICON["spark"]}</i>Workshop recording access</div></div>')
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
