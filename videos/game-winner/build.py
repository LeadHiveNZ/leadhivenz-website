#!/usr/bin/env python3
"""Game-winner hype edit. Writes index.html + timeline.json (read by audio.py).

Footage: assets/full.mp4 is the whole graded 1080x1920 source; *_slow.mp4 are frame-interpolated
slow-motion pulls; freeze_*.jpg are stills from shot_slow. All video is muted; the soundtrack is
synthesised by audio.py and muxed after render.

Story (from the clip's own score pills): white (us, left score) down 17-24 in H2 -> 26-26 -> 33-34
-> J. Weinbach #36 scores with ~3 s left (src 29.06 release, 30.03 through the rim) -> 35-34 final.
"""
import json, math, random

W, H = 1080, 1920
BPM = 150
BEAT = 60 / BPM            # 0.4
BAR = 4 * BEAT             # 1.6
WHITE, RED, GOLD, INK, PURPLE = "#FFFFFF", "#E3262E", "#FFC83D", "#07080C", "#7B4BD6"
SLAM = "'League Gothic', 'Oswald', sans-serif"
LABEL = "'Oswald', sans-serif"
NUM = "'Archivo Black', 'Montserrat', sans-serif"

# ---------------------------------------------------------------- timeline (output seconds)
INTRO_END = 2 * BAR                  # 3.2  drop 1
MONT_END = INTRO_END + 8 * BAR       # 16.0 beat stops, tension
TEN_SRC = (22.00, 27.633)            # final possession wide shot
SHOT1_AT = MONT_END + (TEN_SRC[1] - TEN_SRC[0])   # 21.633 close angle
SLOW_SRC0 = 28.95                    # shot_slow.mp4 starts here in source time
SLOW_K = 0.3125                      # slow-mo speed
SHOT1_SRC = (27.633, SLOW_SRC0)
SLOWA_AT = round(SHOT1_AT + (SHOT1_SRC[1] - SHOT1_SRC[0]), 3)   # 22.95
REL_T = 0.35                         # release inside shot_slow
FREEZE_AT = round(SLOWA_AT + REL_T, 3)                          # 23.30
FREEZE_DUR = 0.9
SLOWB_AT = round(FREEZE_AT + FREEZE_DUR, 3)                     # 24.20
SWISH_T = 3.45                       # ball drops through the rim inside shot_slow
IMPACT = round(SLOWB_AT + SWISH_T - REL_T, 3)                   # 27.30  drop 2
HERO_T = 3.62                        # still used for the hero freeze
HERO_AT = round(IMPACT + HERO_T - SWISH_T, 3)                   # 27.47
REPLAY_AT = round(IMPACT + BAR, 3)                              # 28.90
REPLAY_SRC = (27.64, 30.40)
RIM_AT = round(REPLAY_AT + REPLAY_SRC[1] - REPLAY_SRC[0], 3)    # 31.66
FINAL_AT = round(IMPACT + 4 * BAR, 3)                           # 33.70
TOTAL = round(FINAL_AT + 4.0, 3)                                # 37.70
RIM_SRC0, RIM_K = 29.68, 0.34
RIM_SWISH_EST = RIM_AT + (30.03 - RIM_SRC0) / RIM_K

def src_to_out(s):
    """Output time of a source moment, for the passes that play it."""
    if TEN_SRC[0] <= s <= TEN_SRC[1]:
        return MONT_END + s - TEN_SRC[0]
    if SHOT1_SRC[0] <= s <= SHOT1_SRC[1]:
        return SHOT1_AT + s - SHOT1_SRC[0]
    t = (s - SLOW_SRC0) / SLOW_K
    return SLOWB_AT + t - REL_T

SWISH_SRC = SLOW_SRC0 + SWISH_T * SLOW_K   # 30.03
COUNT = [(src_to_out(SWISH_SRC - 3), "3"), (src_to_out(SWISH_SRC - 2), "2"), (FREEZE_AT, "1")]

# montage: (out_start, out_end, src_start) - every cut on the 150 BPM grid, inside one camera shot
MONT = [(3.20, 4.80, 1.10), (4.80, 5.60, 3.40), (5.60, 6.40, 4.835), (6.40, 7.20, 6.35),
        (7.20, 8.40, 7.20), (8.40, 10.00, 9.40), (10.00, 11.20, 11.80), (11.20, 12.40, 13.30),
        (12.40, 13.20, 14.85), (13.20, 14.00, 17.30), (14.00, 15.20, 18.30), (15.20, 16.00, 20.70)]
SCORE_TIED, SCORE_DOWN1 = 5.60, 7.20

# ---------------------------------------------------------------- camera helper
O = (540, 960)   # transform origin of #cam
def cam(P, S, s):
    """x/y so that source point P lands on screen point S at scale s (origin O), clamped so the
    footage always covers the frame (44 px spare for shake)."""
    x, y = S[0] - O[0] - s * (P[0] - O[0]), S[1] - O[1] - s * (P[1] - O[1])
    mx, my = max(0, O[0] * (s - 1) - 44), max(0, O[1] * (s - 1) - 44)
    return round(min(mx, max(-mx, x)), 1), round(min(my, max(-my, y)), 1)

js = []          # main timeline lines
def T(x):
    return f"{x:.3f}"
def on_screen(P, S, s):
    x, y = cam(P, S, s)
    return O[0] + s * (P[0] - O[0]) + x, O[1] + s * (P[1] - O[1]) + y

def camset(t, P, S, s, dur=0.0, ease="power3.out"):
    x, y = cam(P, S, s)
    if dur <= 0:
        js.append(f'tl.set("#cam", {{ x: {x}, y: {y}, scale: {s:.4f} }}, {T(t)});')
    else:
        js.append(f'tl.to("#cam", {{ x: {x}, y: {y}, scale: {s:.4f}, duration: {dur:.3f}, ease: "{ease}" }}, {T(t)});')

CENTER = (540, 960)
# intro: slow B/W push
camset(0, (540, 1080), CENTER, 1.38)
camset(0.001, (540, 1080), CENTER, 1.52, INTRO_END - 0.05, "sine.inOut")
# montage: every cut lands punched-in and settles (impact zoom), downbeats harder
PILL = {2: 1.31, 4: 1.36}   # montage clips whose source shows the old score pill at the top
for i, (a, b, s0) in enumerate(MONT):
    hard = abs(((a - INTRO_END) / BAR) - round((a - INTRO_END) / BAR)) < 1e-6
    base = PILL.get(i, 1.17)
    F = (540, 1060) if i in PILL else CENTER
    camset(a, F, CENTER, base + (0.19 if hard else 0.11))
    camset(a + 0.001, F, CENTER, base, 0.32 if hard else 0.26, "expo.out")
    camset(a + 0.33, F, CENTER, base + 0.04, b - a - 0.34, "none")   # slow creep keeps it alive
    if b - a >= 1.6:   # a beat-punch inside the long clips
        camset(a + 0.8, F, CENTER, base + 0.1, 0.0)
        camset(a + 0.801, F, CENTER, base + 0.03, 0.25, "expo.out")
# tension: slow creep in on the ball side
camset(MONT_END, CENTER, CENTER, 1.16)
camset(MONT_END + 0.001, (560, 1000), (540, 980), 1.36, SHOT1_AT - MONT_END - 0.01, "sine.in")
# close angle: push onto the shooter
SHOOTER = (711, 640)
camset(SHOT1_AT, (620, 800), (540, 960), 1.18)
camset(SHOT1_AT + 0.001, SHOOTER, (560, 860), 1.42, FREEZE_AT - SHOT1_AT - 0.01, "power2.in")
# freeze: snap tighter on the release
camset(FREEZE_AT, SHOOTER, (560, 860), 1.62)
camset(FREEZE_AT + 0.001, SHOOTER, (560, 860), 1.78, FREEZE_DUR - 0.01, "power1.out")
# slow flight: follow the ball to the rim
HOOP_SLOW = (212, 470)
camset(SLOWB_AT, SHOOTER, (560, 860), 1.62)
camset(SLOWB_AT + 0.001, (450, 360), (560, 900), 1.45, 1.4, "sine.inOut")
camset(SLOWB_AT + 1.41, (240, 300), (520, 860), 1.55, 1.3, "sine.inOut")
camset(IMPACT - 0.39, HOOP_SLOW, (540, 900), 1.95, 0.39, "power2.in")
# hero still: ball in the net, slow push
HOOP_HERO = (210, 470)
camset(HERO_AT, HOOP_HERO, (540, 820), 2.1)
camset(HERO_AT + 0.001, HOOP_HERO, (540, 820), 2.3, REPLAY_AT - HERO_AT - 0.01, "power1.out")
# replay: real speed, wide -> shooter -> rim
camset(REPLAY_AT, CENTER, CENTER, 1.16)
camset(REPLAY_AT + 0.001, (650, 700), (560, 900), 1.3, 1.3, "sine.inOut")
camset(REPLAY_AT + 1.4, (300, 500), (560, 900), 1.45, RIM_AT - REPLAY_AT - 1.41, "sine.inOut")
# rim close-up
HOOP_RIM = (215, 466)
camset(RIM_AT, HOOP_RIM, (540, 900), 2.15)
camset(RIM_AT + 0.001, HOOP_RIM, (540, 900), 2.45, FINAL_AT - RIM_AT - 0.01, "none")
# final: blurred still, gentle drift
camset(FINAL_AT, HOOP_HERO, (540, 900), 1.6)
camset(FINAL_AT + 0.001, HOOP_HERO, (540, 900), 1.8, TOTAL - FINAL_AT - 0.01, "none")

# ---------------------------------------------------------------- footage clips (track 0)
clips = []
def vclip(cid, src, start, dur, media_start=0.0):
    clips.append(f'<video id="{cid}" class="clip" src="assets/{src}" muted playsinline data-start="{T(start)}" '
                 f'data-duration="{T(dur)}" data-media-start="{T(media_start)}" data-track-index="0"></video>')
def iclip(cid, src, start, dur):
    clips.append(f'<img id="{cid}" class="clip" src="assets/{src}" data-start="{T(start)}" data-duration="{T(dur)}" '
                 f'data-track-index="0" alt="" />')

vclip("v-intro", "intro_slow.mp4", 0, INTRO_END)
for i, (a, b, s0) in enumerate(MONT):
    vclip(f"v-m{i}", "full.mp4", a, b - a, s0)
vclip("v-ten", "full.mp4", MONT_END, SHOT1_AT - MONT_END, TEN_SRC[0])
vclip("v-shot1", "full.mp4", SHOT1_AT, SLOWA_AT - SHOT1_AT, SHOT1_SRC[0])
vclip("v-slowa", "shot_slow.mp4", SLOWA_AT, FREEZE_AT - SLOWA_AT, 0)
iclip("i-freeze", "freeze_release.jpg", FREEZE_AT, FREEZE_DUR)
vclip("v-slowb", "shot_slow.mp4", SLOWB_AT, HERO_AT - SLOWB_AT, REL_T)
iclip("i-hero", "freeze_swish.jpg", HERO_AT, REPLAY_AT - HERO_AT)
vclip("v-replay", "full.mp4", REPLAY_AT, RIM_AT - REPLAY_AT, REPLAY_SRC[0])
vclip("v-rim", "rim_slow.mp4", RIM_AT, FINAL_AT - RIM_AT, 0)
iclip("i-final", "freeze_swish.jpg", FINAL_AT, TOTAL - FINAL_AT)

# footage looks: B/W intro, desat tension, B/W freeze, blurred final
js.append(f'tl.set("#cam", {{ filter: "grayscale(1) contrast(1.25) brightness(0.62)" }}, 0);')
js.append(f'tl.set("#cam", {{ filter: "grayscale(0) contrast(1) brightness(1)" }}, {T(INTRO_END)});')
js.append(f'tl.to("#cam", {{ filter: "grayscale(0.55) contrast(1.15) brightness(0.82)", duration: 0.5, ease: "power2.out" }}, {T(MONT_END)});')
js.append(f'tl.set("#cam", {{ filter: "grayscale(0.25) contrast(1.12) brightness(0.92)" }}, {T(SHOT1_AT)});')
js.append(f'tl.set("#cam", {{ filter: "grayscale(1) contrast(1.35) brightness(0.8)" }}, {T(FREEZE_AT)});')
js.append(f'tl.set("#cam", {{ filter: "grayscale(0.15) contrast(1.12) brightness(0.95)" }}, {T(SLOWB_AT)});')
js.append(f'tl.set("#cam", {{ filter: "grayscale(0) contrast(1.08) brightness(1.04) saturate(1.15)" }}, {T(IMPACT)});')
js.append(f'tl.set("#cam", {{ filter: "grayscale(0) contrast(1.05) brightness(1) saturate(1.05)" }}, {T(REPLAY_AT)});')
js.append(f'tl.set("#cam", {{ filter: "blur(14px) brightness(0.45) saturate(1.1)" }}, {T(FINAL_AT)});')

# ---------------------------------------------------------------- ball trail (inside #cam, source px * 1.5)
BALL = [(2, 450, 226), (3, 420, 200), (4, 406, 190), (5, 384, 166), (6, 366, 148), (8, 350, 132), (9, 320, 120),
        (10, 310, 120), (11, 290, 118), (12, 280, 114), (14, 256, 114), (15, 236, 118), (16, 220, 118), (17, 200, 124),
        (18, 190, 132), (20, 176, 140), (21, 160, 156), (22, 140, 174), (23, 126, 194), (24, 114, 214),
        (26, 124, 224), (27, 130, 242), (28, 136, 260), (29, 150, 280), (30, 150, 296), (32, 160, 326)]
pts = [(round(SLOWB_AT + ((29.0 + n / 30) - SLOW_SRC0) / SLOW_K - REL_T, 3), x * 1.5, y * 1.5) for n, x, y in BALL]
trail_svg = [f'<svg id="trail" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
             '<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/>'
             '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>',
             '<g filter="url(#glow)">']
for i in range(1, len(pts)):
    (t0, x0, y0), (t1, x1, y1) = pts[i - 1], pts[i]
    trail_svg.append(f'<line id="tr{i}" x1="{x0:.0f}" y1="{y0:.0f}" x2="{x1:.0f}" y2="{y1:.0f}" stroke="{GOLD}" '
                     f'stroke-width="16" stroke-linecap="round" opacity="0"/>')
    js.append(f'tl.fromTo("#tr{i}", {{ opacity: 0 }}, {{ opacity: 0.9, duration: 0.06, ease: "none" }}, {T(t1 - 0.06)});')
    js.append(f'tl.to("#tr{i}", {{ opacity: 0, strokeWidth: 3, duration: 0.9, ease: "power1.in" }}, {T(t1 + 0.05)});')
trail_svg.append(f'<circle id="ballglow" cx="0" cy="0" r="34" fill="none" stroke="{WHITE}" stroke-width="6" opacity="0"/>')
trail_svg.append('</g></svg>')
t0, x0, y0 = pts[0]
js.append(f'tl.set("#ballglow", {{ attr: {{ cx: {x0:.0f}, cy: {y0:.0f} }}, opacity: 0.95 }}, {T(SLOWB_AT)});')
for (ta, xa, ya), (tb, xb, yb) in zip(pts, pts[1:]):
    js.append(f'tl.to("#ballglow", {{ attr: {{ cx: {xb:.0f}, cy: {yb:.0f} }}, duration: {tb - ta:.3f}, ease: "none" }}, {T(ta)});')
js.append(f'tl.to("#ballglow", {{ opacity: 0, duration: 0.15 }}, {T(IMPACT - 0.1)});')

# ---------------------------------------------------------------- overlay builders
html_over = []    # overlays above footage (not clips; GSAP owns their opacity)
def slam(eid, text, t_in, t_out, top, size, color=WHITE, glow=RED, from_dir="scale", skew=-8, align="center"):
    """Big League Gothic word with RGB-split ghosts that snap together on the hit."""
    html_over.append(
        f'<div class="slam" id="{eid}" style="top:{top}px; font-size:{size}px; text-align:{align};">'
        f'<span class="ghost r" id="{eid}-r">{text}</span><span class="ghost c" id="{eid}-c">{text}</span>'
        f'<span class="main" id="{eid}-m" style="color:{color}; text-shadow: 0 0 46px {glow}aa, 0 8px 0 {glow};">{text}</span></div>')
    js.append(f'tl.set("#{eid}", {{ opacity: 1, skewX: {skew} }}, {T(t_in - 0.12)});')
    if from_dir == "scale":
        js.append(f'tl.fromTo("#{eid}-m", {{ scale: 2.4, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.16, ease: "power4.in" }}, {T(t_in - 0.12)});')
        js.append(f'tl.fromTo("#{eid}", {{ scale: 1 }}, {{ scale: 1.035, duration: {max(0.3, t_out - t_in - 0.2):.3f}, ease: "none" }}, {T(t_in + 0.04)});')
    else:
        dx = -900 if from_dir == "left" else 900
        js.append(f'tl.fromTo("#{eid}-m", {{ x: {dx}, opacity: 0 }}, {{ x: 0, opacity: 1, duration: 0.14, ease: "power4.in" }}, {T(t_in - 0.12)});')
    for g, dx in (("r", -26), ("c", 26)):
        js.append(f'tl.fromTo("#{eid}-{g}", {{ x: {dx}, opacity: 0.85 }}, {{ x: 0, opacity: 0, duration: 0.28, ease: "power2.out" }}, {T(t_in + 0.02)});')
    js.append(f'tl.to("#{eid}", {{ opacity: 0, scale: 1.12, filter: "blur(10px)", duration: 0.14, ease: "power2.in" }}, {T(t_out - 0.14)});')
    js.append(f'tl.set("#{eid}", {{ opacity: 0, visibility: "hidden" }}, {T(t_out)});')

def label(eid, text, t_in, t_out, top, size=54, color=WHITE, spacing=0.32):
    html_over.append(f'<div class="label" id="{eid}" style="top:{top}px; font-size:{size}px; color:{color}; letter-spacing:{spacing}em;">{text}</div>')
    js.append(f'tl.fromTo("#{eid}", {{ opacity: 0, y: 18, scale: 1.12 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" }}, {T(t_in)});')
    js.append(f'tl.to("#{eid}", {{ opacity: 0, duration: 0.15 }}, {T(t_out - 0.15)});')
    js.append(f'tl.set("#{eid}", {{ visibility: "hidden" }}, {T(t_out)});')

flash_times, redflash_times, shakes = [], [], []

# intro
label("l-2h", "SECOND HALF", 0.25, INTRO_END - 0.05, 640, 50, "#D9DCE3")
slam("s-down7", "DOWN 7", 0.80, INTRO_END - 0.02, 720, 330)
html_over.append(f'<div class="introscore" id="introscore"><span>17</span><i></i><span>24</span></div>')
js.append(f'tl.fromTo("#introscore", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, 1.60);')
js.append(f'tl.to("#introscore", {{ opacity: 0, duration: 0.12 }}, {T(INTRO_END - 0.14)});')
js.append(f'tl.set("#introscore", {{ visibility: "hidden" }}, {T(INTRO_END)});')
shakes += [(0.80, 0.35, 16), (1.60, 0.2, 8)]
# montage
slam("s-comeback", "THE COMEBACK", INTRO_END, INTRO_END + BAR - 0.05, 780, 205)
slam("s-tied", "TIED UP", SCORE_TIED, SCORE_TIED + BAR - 0.05, 760, 280, WHITE, PURPLE)
for i, (a, b, s0) in enumerate(MONT):
    hard = abs(((a - INTRO_END) / BAR) - round((a - INTRO_END) / BAR)) < 1e-6
    (flash_times if hard else redflash_times).append(a)
    shakes.append((a, 0.22 if hard else 0.14, 14 if hard else 7))
# tension
slam("s-down1", "DOWN 1", MONT_END + 0.02, MONT_END + 1.9, 760, 330)
label("l-final", "FINAL POSSESSION", MONT_END + 2.0, COUNT[0][0] - 0.1, 880, 70, WHITE, 0.18)
flash_times.append(MONT_END)
shakes.append((MONT_END, 0.4, 18))
for k, (tc, n) in enumerate(COUNT):
    t_out = COUNT[k + 1][0] if k + 1 < len(COUNT) else SLOWB_AT
    html_over.append(f'<div class="count" id="cnt{n}">{n}</div>')
    js.append(f'tl.fromTo("#cnt{n}", {{ opacity: 0, scale: 1.9 }}, {{ opacity: 1, scale: 1, duration: 0.14, ease: "power4.in" }}, {T(tc - 0.1)});')
    js.append(f'tl.to("#cnt{n}", {{ scale: 0.92, duration: {t_out - tc - 0.2:.3f}, ease: "none" }}, {T(tc + 0.05)});')
    js.append(f'tl.to("#cnt{n}", {{ opacity: 0, scale: 0.8, duration: 0.15 }}, {T(t_out - 0.15)});')
    js.append(f'tl.set("#cnt{n}", {{ visibility: "hidden" }}, {T(t_out)});')
    shakes.append((tc, 0.25, 12))
    redflash_times.append(tc)

# freeze: spotlight + name callout
SPOT = (560, 860 - 1.78 * 0 - 120)   # shooter's head/torso on screen during the freeze
html_over.append(f'<div id="spot"></div>')
js.append(f'tl.fromTo("#spot", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.12 }}, {T(FREEZE_AT)});')
js.append(f'tl.to("#spot", {{ opacity: 0, duration: 0.18 }}, {T(SLOWB_AT - 0.1)});')
html_over.append('<svg id="callout" viewBox="0 0 1080 1920" width="1080" height="1920"><polyline id="callout-line" points="650,830 720,1000 1030,1000" '
                 f'fill="none" stroke="{GOLD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" '
                 'stroke-dasharray="1" stroke-dashoffset="1"/></svg>')
html_over.append(f'<div id="nameplate"><div class="np-num">#36</div><div class="np-name">J. WEINBACH</div></div>')
js.append(f'tl.set("#callout", {{ opacity: 1 }}, {T(FREEZE_AT)});')
js.append(f'tl.to("#callout-line", {{ strokeDashoffset: 0, duration: 0.22, ease: "power2.out" }}, {T(FREEZE_AT + 0.05)});')
js.append(f'tl.fromTo("#nameplate", {{ opacity: 0, x: 60 }}, {{ opacity: 1, x: 0, duration: 0.22, ease: "power3.out" }}, {T(FREEZE_AT + 0.16)});')
js.append(f'tl.to(["#callout", "#nameplate"], {{ opacity: 0, duration: 0.15 }}, {T(SLOWB_AT - 0.12)});')
flash_times.append(FREEZE_AT)

# impact
flash_times += [IMPACT, HERO_AT]
shakes += [(IMPACT, 0.7, 34), (HERO_AT + 0.08, 0.35, 14)]
html_over.append(f'<div id="ring"></div><div id="ring2"></div>')
RING_AT = (540, 900)
hx, hy = on_screen(HOOP_SLOW, (540, 900), 1.95)
rx, ry = on_screen(HOOP_RIM, (540, 900), 2.15 + (2.45 - 2.15) * (RIM_SWISH_EST - RIM_AT) / (FINAL_AT - RIM_AT))
js.append(f'tl.set(["#ring", "#ring2", "#rays"], {{ x: {hx - RING_AT[0]:.0f}, y: {hy - RING_AT[1]:.0f} }}, {T(IMPACT - 0.05)});')
js.append(f'tl.set("#ring3", {{ x: {rx - RING_AT[0]:.0f}, y: {ry - RING_AT[1]:.0f} }}, {T(RIM_AT)});')
for rid, d, sc in (("ring", 0.0, 9), ("ring2", 0.08, 13)):
    js.append(f'tl.fromTo("#{rid}", {{ opacity: 1, scale: 0.2 }}, {{ opacity: 0, scale: {sc}, duration: 0.7, ease: "expo.out" }}, {T(IMPACT + d)});')
html_over.append('<div id="rays"></div>')
js.append(f'tl.fromTo("#rays", {{ opacity: 0.0, scale: 0.6, rotation: 0 }}, {{ opacity: 0.85, scale: 1.25, rotation: 8, duration: 0.18, ease: "power2.out" }}, {T(IMPACT)});')
js.append(f'tl.to("#rays", {{ opacity: 0, scale: 1.6, rotation: 14, duration: 0.6, ease: "power2.in" }}, {T(IMPACT + 0.18)});')
slam("s-game", "GAME", HERO_AT + 0.02, REPLAY_AT - 0.02, 1040, 300, WHITE, RED, "left")
slam("s-winner", "WINNER", HERO_AT + 0.16, REPLAY_AT - 0.02, 1290, 300, GOLD, RED, "right")
html_over.append(f'<div class="label" id="l-hero" style="top:1610px; font-size:46px; color:{WHITE}; letter-spacing:0.28em;">J. WEINBACH #36</div>')
js.append(f'tl.fromTo("#l-hero", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {T(HERO_AT + 0.4)});')
js.append(f'tl.to("#l-hero", {{ opacity: 0, duration: 0.12 }}, {T(REPLAY_AT - 0.14)});')
js.append(f'tl.set("#l-hero", {{ visibility: "hidden" }}, {T(REPLAY_AT)});')

# replay badge
html_over.append(f'<div id="replay"><span class="rec"></span>REPLAY</div>')
js.append(f'tl.fromTo("#replay", {{ opacity: 0, x: -40 }}, {{ opacity: 1, x: 0, duration: 0.25, ease: "power3.out" }}, {T(REPLAY_AT + 0.05)});')
js.append(f'tl.to(".rec", {{ opacity: 0.15, duration: 0.3, repeat: 7, yoyo: true, ease: "none" }}, {T(REPLAY_AT + 0.1)});')
js.append(f'tl.to("#replay", {{ opacity: 0, duration: 0.15 }}, {T(FINAL_AT - 0.15)});')
js.append(f'tl.set("#replay", {{ visibility: "hidden" }}, {T(FINAL_AT)});')
REPLAY_SWISH = REPLAY_AT + (30.03 - REPLAY_SRC[0])
RIM_SWISH = RIM_AT + (30.03 - RIM_SRC0) / RIM_K
redflash_times += [REPLAY_AT, RIM_AT]
soft_flash = [REPLAY_SWISH, RIM_SWISH]
shakes += [(REPLAY_SWISH, 0.3, 12), (RIM_SWISH, 0.45, 20)]
html_over.append('<div id="ring3"></div>')
js.append(f'tl.fromTo("#ring3", {{ opacity: 1, scale: 0.3 }}, {{ opacity: 0, scale: 7, duration: 0.6, ease: "expo.out" }}, {T(RIM_SWISH)});')
# letterbox during tension -> impact
html_over.append('<div class="bar" id="bar-top"></div><div class="bar" id="bar-bot"></div>')
js.append('tl.set("#bar-top", { y: -240 }, 0);')
js.append('tl.set("#bar-bot", { y: 240 }, 0);')
js.append(f'tl.fromTo("#bar-top", {{ y: -240 }}, {{ y: 0, duration: 0.6, ease: "power3.out" }}, {T(MONT_END)});')
js.append(f'tl.fromTo("#bar-bot", {{ y: 240 }}, {{ y: 0, duration: 0.6, ease: "power3.out" }}, {T(MONT_END)});')
js.append(f'tl.set("#bar-top", {{ y: -240 }}, {T(IMPACT)});')   # snaps away under the impact flash
js.append(f'tl.set("#bar-bot", {{ y: 240 }}, {T(IMPACT)});')

# final card
html_over.append(f'''<div id="final">
  <div class="f-label" id="f-label">FINAL</div>
  <div class="f-board" id="f-board">
    <div class="f-team"><i style="background:{WHITE}"></i><span class="f-score" id="f-us">35</span></div>
    <div class="f-dash"></div>
    <div class="f-team them"><span class="f-score" id="f-them">34</span><i style="background:{PURPLE}"></i></div>
  </div>
  <div class="f-big" id="f-big">WON BY <span>ONE</span></div>
  <div class="f-sub" id="f-sub">IN THE LAST 3 SECONDS</div>
</div>''')
js.append(f'tl.set("#final", {{ opacity: 1 }}, {T(FINAL_AT)});')
js.append(f'tl.fromTo("#f-label", {{ opacity: 0, y: -20, scale: 1.2 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" }}, {T(FINAL_AT + 0.05)});')
js.append(f'tl.fromTo("#f-board", {{ opacity: 0, scale: 1.6 }}, {{ opacity: 1, scale: 1, duration: 0.18, ease: "power4.in" }}, {T(FINAL_AT)});')
js.append(f'tl.fromTo("#f-big", {{ opacity: 0, scale: 2.2 }}, {{ opacity: 1, scale: 1, duration: 0.16, ease: "power4.in" }}, {T(FINAL_AT + BAR / 2 - 0.12)});')
js.append(f'tl.fromTo("#f-sub", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }}, {T(FINAL_AT + BAR)});')
js.append(f'tl.to("#final", {{ scale: 1.05, duration: {TOTAL - FINAL_AT - 0.2:.3f}, ease: "none" }}, {T(FINAL_AT + 0.2)});')
js.append(f'tl.to("#final", {{ opacity: 0, duration: 0.5, ease: "power1.in" }}, {T(TOTAL - 0.5)});')
flash_times += [FINAL_AT, FINAL_AT + BAR / 2]
shakes += [(FINAL_AT, 0.4, 16), (FINAL_AT + BAR / 2, 0.3, 12)]

# ---------------------------------------------------------------- scorebug (montage -> rim)
html_over.append(f'''<div id="bug">
  <div class="b-team"><i style="background:{WHITE}"></i><span class="b-num" id="b-us"><b id="bu0">17</b><b id="bu1">26</b><b id="bu2">33</b><b id="bu3">35</b></span></div>
  <div class="b-mid" id="b-mid">H2</div>
  <div class="b-team"><span class="b-num" id="b-them"><b id="bt0">24</b><b id="bt1">26</b><b id="bt2">34</b></span><i style="background:{PURPLE}"></i></div>
</div>''')
js.append(f'tl.fromTo("#bug", {{ opacity: 0, y: -30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {T(INTRO_END + 0.1)});')
for grp, seq in (("bu", [(0, INTRO_END), (1, SCORE_TIED), (2, SCORE_DOWN1), (3, IMPACT)]),
                 ("bt", [(0, INTRO_END), (1, SCORE_TIED), (2, SCORE_DOWN1)])):
    for k, (idx, t) in enumerate(seq):
        if k > 0:
            prev = seq[k - 1][0]
            js.append(f'tl.to("#{grp}{prev}", {{ yPercent: -100, opacity: 0, duration: 0.18, ease: "power2.in" }}, {T(t - 0.05)});')
            js.append(f'tl.fromTo("#{grp}{idx}", {{ yPercent: 100, opacity: 0 }}, {{ yPercent: 0, opacity: 1, duration: 0.22, ease: "back.out(2)" }}, {T(t + 0.08)});')
        else:
            js.append(f'tl.set("#{grp}{idx}", {{ yPercent: 0, opacity: 1 }}, {T(t)});')
for t in (SCORE_TIED, SCORE_DOWN1):
    js.append(f'tl.fromTo("#bug", {{ scale: 1.18 }}, {{ scale: 1, duration: 0.35, ease: "back.out(3)" }}, {T(t + 0.08)});')
js.append(f'tl.fromTo("#bug", {{ scale: 1.35 }}, {{ scale: 1, duration: 0.5, ease: "back.out(3)" }}, {T(IMPACT + 0.08)});')
js.append(f'tl.set("#bu3", {{ color: "{GOLD}" }}, {T(IMPACT)});')
js.append(f'tl.set("#bug", {{ y: 150 }}, {T(MONT_END)});')      # sits under the letterbox bar
js.append(f'tl.set("#bug", {{ y: 0 }}, {T(IMPACT)});')
js.append(f'tl.to("#bug", {{ opacity: 0, duration: 0.15 }}, {T(FINAL_AT - 0.15)});')

# ---------------------------------------------------------------- flashes, shake, leaks, grain, confetti
for t in soft_flash:
    js.append(f'tl.fromTo("#flash2", {{ opacity: 0.6 }}, {{ opacity: 0, duration: 0.25, ease: "power2.out" }}, {T(t)});')
for tid, times, op, d in (("flash", flash_times, 0.95, 0.22), ("rflash", redflash_times, 0.55, 0.18)):
    times = sorted(set(round(t, 3) for t in times))
    for k, t in enumerate(times):
        dd = min(d, (times[k + 1] - t - 0.01) if k + 1 < len(times) else d)
        js.append(f'tl.fromTo("#{tid}", {{ opacity: {op} }}, {{ opacity: 0, duration: {dd:.3f}, ease: "power2.out" }}, {T(t)});')

rnd = random.Random(36)
shake_js = {}
for t0, dur, amp in sorted(shakes):
    n = max(2, int(dur * 30))
    for k in range(n):
        f = (1 - k / n) ** 1.6
        shake_js[round(t0 + k / 30, 3)] = (rnd.uniform(-1, 1) * amp * f, rnd.uniform(-1, 1) * amp * f, rnd.uniform(-1, 1) * amp * 0.06 * f)
    shake_js.setdefault(round(t0 + n / 30, 3), (0, 0, 0))
for t, (x, y, r) in sorted(shake_js.items()):
    js.append(f'tl.set("#stage", {{ x: {x:.1f}, y: {y:.1f}, rotation: {r:.2f} }}, {T(t)});')

# light leaks: drift through the intro, impact, final
for lid, sched in (("leak1", [(0.0, INTRO_END, 0.55), (IMPACT, REPLAY_AT, 0.6), (FINAL_AT, TOTAL, 0.5)]),
                   ("leak2", [(1.2, INTRO_END, 0.4), (HERO_AT, REPLAY_AT, 0.5), (FINAL_AT + 0.4, TOTAL, 0.45)])):
    for a, b, op in sched:
        js.append(f'tl.fromTo("#{lid}", {{ opacity: 0, x: -120, y: 60 }}, {{ opacity: {op}, x: 80, y: -40, duration: {(b - a) * 0.6:.3f}, ease: "sine.out" }}, {T(a)});')
        js.append(f'tl.to("#{lid}", {{ opacity: 0, x: 160, duration: {(b - a) * 0.4:.3f}, ease: "sine.in" }}, {T(a + (b - a) * 0.6)});')

for k in range(int(TOTAL * 15)):   # grain jitter, 15 steps a second
    js.append(f'tl.set("#grain", {{ x: {rnd.randint(-180, 0)}, y: {rnd.randint(-180, 0)} }}, {T(k / 15)});')

conf = []
CONF_COLORS = [WHITE, RED, GOLD, WHITE, "#C9CED8", RED, GOLD]
def confetti(prefix, t0, n, origin, spread, up, fall_t):
    for i in range(n):
        cid = f"{prefix}{i}"
        w, h = rnd.choice([(14, 26), (18, 18), (10, 30), (22, 12)])
        c = rnd.choice(CONF_COLORS)
        conf.append(f'<span class="cf" id="{cid}" style="width:{w}px;height:{h}px;background:{c};left:{origin[0]}px;top:{origin[1]}px;"></span>')
        vx = rnd.uniform(*spread)
        peak = -rnd.uniform(*up)
        t_up = round(rnd.uniform(0.35, 0.6), 3)
        tf = round(rnd.uniform(*fall_t), 3)
        delay = round(rnd.uniform(0, 0.12), 3)
        js.append(f'tl.set("#{cid}", {{ opacity: 1, x: 0, y: 0, rotation: {rnd.randint(0, 360)} }}, {T(t0 + delay)});')
        js.append(f'tl.to("#{cid}", {{ x: {vx * 0.55:.0f}, y: {peak:.0f}, duration: {t_up:.3f}, ease: "power2.out" }}, {T(t0 + delay)});')
        js.append(f'tl.to("#{cid}", {{ x: {vx:.0f}, y: {peak + 2300:.0f}, duration: {tf:.3f}, ease: "power1.in" }}, {T(t0 + delay + t_up)});')
        js.append(f'tl.to("#{cid}", {{ rotation: "+={rnd.choice([-1, 1]) * rnd.randint(540, 1440)}", rotationX: {rnd.randint(360, 1080)}, duration: {t_up + tf:.3f}, ease: "none" }}, {T(t0 + delay)});')
confetti("cl", IMPACT, 36, (-20, 1700), (150, 900), (900, 1500), (2.4, 3.6))
confetti("cr", IMPACT, 36, (1080, 1700), (-900, -150), (900, 1500), (2.4, 3.6))
confetti("ct", FINAL_AT, 40, (540, -60), (-620, 620), (-40, 80), (2.6, 4.2))
js.append(f'tl.set({{}}, {{}}, {T(TOTAL)});')

import re
_ft = re.compile(r'^tl\.fromTo\("([^"]+)", (\{.*?\}), \{ (.*) \}, ([0-9.]+)\);$')
for i, l in enumerate(js):
    m = _ft.match(l)
    if m and float(m.group(4)) > 0:
        js[i] = f'tl.set("{m.group(1)}", {m.group(2)}, {m.group(4)}); tl.to("{m.group(1)}", {{ {m.group(3)} }}, {m.group(4)});'

# ---------------------------------------------------------------- page
css = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:{INK}; }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:{INK}; }}
#stage {{ position:absolute; inset:-40px; will-change:transform; }}
#cam {{ position:absolute; left:40px; top:40px; width:{W}px; height:{H}px; transform-origin:{O[0]}px {O[1]}px; will-change:transform, filter; }}
#cam video, #cam img {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
#trail {{ position:absolute; inset:0; }}
#vignette {{ position:absolute; inset:0; background:radial-gradient(ellipse 75% 62% at 50% 48%, transparent 55%, rgba(0,0,0,0.62) 100%); }}
.leak {{ position:absolute; width:1400px; height:1400px; border-radius:50%; mix-blend-mode:screen; opacity:0; filter:blur(60px); }}
#leak1 {{ left:-560px; top:-380px; background:radial-gradient(circle, rgba(255,120,40,0.9), rgba(227,38,46,0.35) 45%, transparent 70%); }}
#leak2 {{ right:-620px; bottom:-300px; background:radial-gradient(circle, rgba(255,200,61,0.85), rgba(255,90,40,0.3) 45%, transparent 70%); }}
#grain {{ position:absolute; left:0; top:0; width:{W + 200}px; height:{H + 200}px; opacity:0.13; mix-blend-mode:overlay;
  background:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }}
#flash, #flash2 {{ position:absolute; inset:0; background:#fff; opacity:0; mix-blend-mode:screen; }}
#rflash {{ position:absolute; inset:0; background:radial-gradient(circle at 50% 50%, rgba(227,38,46,0.2), rgba(227,38,46,0.85)); opacity:0; mix-blend-mode:screen; }}
.bar {{ position:absolute; left:0; right:0; height:240px; background:#000; }}
#bar-top {{ top:0; }}
#bar-bot {{ bottom:0; }}
.slam {{ position:absolute; left:0; right:0; font-family:{SLAM}; line-height:0.86; text-transform:uppercase; opacity:0;
        letter-spacing:0.01em; white-space:nowrap; transform-origin:50% 50%; }}
.slam span {{ display:block; }}
.slam .ghost {{ position:absolute; left:0; right:0; top:0; mix-blend-mode:screen; opacity:0; }}
.slam .ghost.r {{ color:#ff1f3d; }}
.slam .ghost.c {{ color:#21e6ff; }}
.slam .main {{ position:relative; }}
.label {{ position:absolute; left:0; right:0; text-align:center; font-family:{LABEL}; font-weight:700; text-transform:uppercase;
         opacity:0; text-shadow:0 3px 18px rgba(0,0,0,0.7); }}
.introscore {{ position:absolute; left:0; right:0; top:1050px; display:flex; justify-content:center; align-items:center; gap:34px;
              font-family:{NUM}; font-size:120px; color:#fff; opacity:0; text-shadow:0 6px 30px rgba(0,0,0,0.6); }}
.introscore i {{ width:60px; height:12px; background:{RED}; display:block; }}
.count {{ position:absolute; left:0; right:0; top:1020px; text-align:center; font-family:{SLAM}; font-size:620px; line-height:0.8;
         color:rgba(227,38,46,0.42); -webkit-text-stroke:10px #fff; opacity:0; text-shadow:0 0 60px rgba(227,38,46,0.6); }}
#spot {{ position:absolute; inset:0; opacity:0; background:radial-gradient(circle at 560px 760px, transparent 0 210px, rgba(0,0,0,0.78) 380px); }}
#callout {{ position:absolute; inset:0; opacity:0; }}
#nameplate {{ position:absolute; left:730px; top:1012px; opacity:0; text-align:left; font-family:{LABEL}; color:#fff; }}
#nameplate .np-num {{ font-family:{SLAM}; font-size:150px; line-height:0.9; color:{GOLD}; }}
#nameplate .np-name {{ font-size:48px; font-weight:700; letter-spacing:0.12em; }}
#ring, #ring2, #ring3 {{ position:absolute; left:{RING_AT[0] - 70}px; top:{RING_AT[1] - 70}px; width:140px; height:140px; border-radius:50%;
       border:10px solid {GOLD}; opacity:0; box-shadow:0 0 40px {GOLD}; }}
#ring2 {{ border-color:#fff; border-width:4px; }}
#rays {{ position:absolute; left:{RING_AT[0] - 1100}px; top:{RING_AT[1] - 1100}px; width:2200px; height:2200px; opacity:0; mix-blend-mode:screen;
        background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.5) 0deg 2deg, transparent 2deg 12deg);
        -webkit-mask-image:radial-gradient(circle, transparent 12%, #000 30%, transparent 70%); }}
#replay {{ position:absolute; left:60px; top:430px; display:flex; align-items:center; gap:16px; padding:12px 26px 12px 20px;
          background:rgba(7,8,12,0.82); border-left:8px solid {RED}; font-family:{LABEL}; font-weight:700; font-size:44px;
          letter-spacing:0.22em; color:#fff; opacity:0; }}
#replay .rec {{ width:20px; height:20px; border-radius:50%; background:{RED}; display:block; }}
#bug {{ position:absolute; left:50%; top:300px; margin-left:-260px; width:520px; height:96px; display:flex; align-items:stretch;
       background:rgba(7,8,12,0.88); border-radius:18px; overflow:hidden; opacity:0; box-shadow:0 14px 34px rgba(0,0,0,0.45);
       border:2px solid rgba(255,255,255,0.12); transform-origin:50% 50%; }}
.b-team {{ flex:1; display:flex; align-items:center; justify-content:center; gap:22px; }}
.b-team i {{ width:12px; height:56px; border-radius:6px; display:block; }}
.b-num {{ position:relative; width:110px; height:80px; overflow:hidden; font-family:{NUM}; font-size:64px; line-height:80px; color:#fff; text-align:center; }}
.b-num b {{ position:absolute; left:0; right:0; top:0; font-weight:400; opacity:0; }}
.b-mid {{ width:96px; display:flex; align-items:center; justify-content:center; background:{RED}; font-family:{LABEL}; font-weight:700;
         font-size:36px; color:#fff; letter-spacing:0.06em; }}
#final {{ position:absolute; inset:0; opacity:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px;
         padding-bottom:40px; transform-origin:50% 50%; }}
.f-label {{ font-family:{LABEL}; font-weight:700; font-size:64px; letter-spacing:0.5em; color:{GOLD}; padding-left:0.5em; }}
.f-board {{ display:flex; align-items:center; gap:38px; background:rgba(7,8,12,0.75); border:3px solid rgba(255,255,255,0.18);
           border-radius:34px; padding:26px 56px; box-shadow:0 30px 80px rgba(0,0,0,0.5); }}
.f-team {{ display:flex; align-items:center; gap:28px; }}
.f-team i {{ width:18px; height:150px; border-radius:9px; display:block; }}
.f-score {{ font-family:{NUM}; font-size:200px; line-height:1; color:#fff; }}
#f-us {{ color:{GOLD}; text-shadow:0 0 50px rgba(255,200,61,0.5); }}
#f-them {{ color:rgba(255,255,255,0.55); }}
.f-dash {{ width:56px; height:14px; background:#fff; border-radius:7px; }}
.f-big {{ font-family:{SLAM}; font-size:250px; line-height:0.88; color:#fff; text-transform:uppercase; transform:skewX(-8deg);
         text-shadow:0 8px 0 {RED}, 0 0 50px rgba(227,38,46,0.6); }}
.f-big span {{ color:{GOLD}; }}
.f-sub {{ font-family:{LABEL}; font-weight:700; font-size:50px; letter-spacing:0.3em; color:#fff; padding-left:0.3em; }}
#confetti {{ position:absolute; inset:0; perspective:900px; }}
.cf {{ position:absolute; opacity:0; border-radius:3px; will-change:transform; }}
"""

index = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Game winner</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{T(TOTAL)}">
      <div id="stage">
        <div id="cam">
{chr(10).join('          ' + c for c in clips)}
          {''.join(trail_svg)}
        </div>
      </div>
      <div id="vignette"></div>
      <div class="leak" id="leak1"></div><div class="leak" id="leak2"></div>
      <div id="rflash"></div>
{chr(10).join('      ' + h for h in html_over)}
      <div id="confetti">{''.join(conf)}</div>
      <div id="flash"></div><div id="flash2"></div>
      <div id="grain"></div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join('      ' + l for l in js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)

timeline = dict(bpm=BPM, total=TOTAL, intro_end=INTRO_END, mont_end=MONT_END, shot1=SHOT1_AT, slowa=SLOWA_AT,
                freeze=FREEZE_AT, slowb=SLOWB_AT, impact=IMPACT, hero=HERO_AT, replay=REPLAY_AT, rim=RIM_AT, final=FINAL_AT,
                count=[c[0] for c in COUNT], slams=[0.80, 1.60, SCORE_TIED], score_changes=[SCORE_TIED, SCORE_DOWN1],
                montage_cuts=[m[0] for m in MONT], replay_swish=REPLAY_SWISH, rim_swish=RIM_SWISH)
json.dump(timeline, open("timeline.json", "w"), indent=1)
print(json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in timeline.items()}))
print("tweens/sets:", len(js))
