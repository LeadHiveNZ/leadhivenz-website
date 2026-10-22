#!/usr/bin/env python3
"""Generate placeholder photos + the real OG image for the Living Colour site.

Requires Pillow (pip install pillow). Not part of the normal build: run once,
then overwrite the placeholders in src/img/ with real photos of the SAME names.

    python3 tools/make_images.py            # placeholders that don't exist yet + og.jpg
    python3 tools/make_images.py --force    # regenerate every placeholder too
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "src", "img")
BRAND = os.path.join(IMG, "brand")
FONT_DIR = os.path.join(ROOT, "tools", "fonts")
NAVY = (8, 20, 28)
ACCENTS = [(0, 99, 207), (0, 148, 60), (216, 8, 20), (58, 83, 104)]

SLOTS = []
for n in "home interior exterior roof commercial prep staining about contact areas reviews projects process faq".split():
    SLOTS.append((f"hero-{n}.jpg", 2000, 1125))
for n in "interior exterior roof commercial prep staining".split():
    SLOTS.append((f"service-{n}.jpg", 1200, 900))
for i in range(1, 10):
    SLOTS.append((f"project-{i:02d}.jpg", 1200, 900))
for n in "detail-brush detail-roller detail-swatches detail-weatherboard detail-door auckland-skyline".split():
    SLOTS.append((f"{n}.jpg", 1200, 900))
SLOTS.append(("about-andy.jpg", 1000, 1250))


def font(size, bold=False):
    for p in ([os.path.join(FONT_DIR, "Montserrat-ExtraBold.ttf")] if bold else []) + [
        "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def placeholder(name, w, h, idx):
    accent = mix(ACCENTS[idx % len(ACCENTS)], NAVY, 0.45)
    # diagonal navy -> accent gradient (computed small, then scaled = smooth + fast)
    sw, sh = 160, max(2, int(160 * h / w))
    small = Image.new("RGB", (sw, sh))
    px = small.load()
    for y in range(sh):
        for x in range(sw):
            t = (x / sw * 0.65 + y / sh * 0.35)
            t = t * t * (3 - 2 * t)
            px[x, y] = mix(NAVY, accent, t)
    im = small.resize((w, h), Image.BICUBIC)
    # soft glow
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    r = int(min(w, h) * 0.55)
    cx, cy = int(w * 0.72), int(h * 0.35)
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(r // 2))
    im = Image.composite(Image.new("RGB", (w, h), mix(accent, (255, 255, 255), 0.35)), im, glow)
    # subtle diagonal hatch
    hatch = Image.new("L", (w, h), 0)
    hd = ImageDraw.Draw(hatch)
    step = max(18, w // 60)
    for k in range(-h, w, step):
        hd.line([(k, h), (k + h, 0)], fill=14, width=max(1, w // 900))
    im = Image.composite(Image.new("RGB", (w, h), (255, 255, 255)), im, hatch)
    d = ImageDraw.Draw(im)
    f = font(max(14, w // 70))
    d.text((int(w * 0.03), h - int(w * 0.03) - f.size), f"placeholder · {name}", font=f, fill=(214, 222, 230))
    im.save(os.path.join(IMG, name), "JPEG", quality=82, optimize=True, progressive=True)


def og():
    w, h = 1200, 630
    im = Image.new("RGB", (w, h), (255, 255, 255))
    logo = Image.open(os.path.join(BRAND, "logo.png")).convert("RGBA")
    lw = 620
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    im.paste(logo, ((w - lw) // 2, 52), logo)
    band_top = 430
    d = ImageDraw.Draw(im)
    # four-colour swatch strip
    cols = [(0, 99, 207), (0, 148, 60), (253, 178, 7), (216, 8, 20)]
    for i, c in enumerate(cols):
        d.rectangle([i * w // 4, band_top - 8, (i + 1) * w // 4, band_top], fill=c)
    d.rectangle([0, band_top, w, h], fill=NAVY)
    t1 = "Auckland painters since 2014"
    f1 = font(54, bold=True)
    tw = d.textlength(t1, font=f1)
    d.text(((w - tw) / 2, band_top + 40), t1, font=f1, fill=(255, 255, 255))
    t2 = "Interior · Exterior · Commercial  |  5.0 on Google  |  021 266 8689"
    f2 = font(28)
    tw = d.textlength(t2, font=f2)
    d.text(((w - tw) / 2, band_top + 122), t2, font=f2, fill=(200, 210, 218))
    im.save(os.path.join(IMG, "og.jpg"), "JPEG", quality=88, optimize=True)


if __name__ == "__main__":
    force = "--force" in sys.argv
    os.makedirs(IMG, exist_ok=True)
    for i, (n, w, h) in enumerate(SLOTS):
        if force or not os.path.exists(os.path.join(IMG, n)):
            placeholder(n, w, h, i)
            print("placeholder", n)
    og()
    print("og.jpg")
