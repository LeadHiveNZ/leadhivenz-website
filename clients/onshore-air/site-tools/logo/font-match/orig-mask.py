#!/usr/bin/env python3
"""Builds orig_mask.png / orig_meta.json: the original wordmark's solid letter shapes (inline filled in, counters kept)
from ../../source/onshore-logo-original.png. Needs numpy + Pillow. Run: python3 -I orig-mask.py"""
import json, os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
im = np.asarray(Image.open(os.path.join(HERE, '..', '..', 'source', 'onshore-logo-original.png')).convert('RGB')).astype(float)
Y0 = 277                                  # below the sphere
ink = im[Y0:380, 0:566].max(axis=2) > 90
ys, xs = np.nonzero(ink); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
pad = 3
crop = ink[y0 - pad:y1 + 1 + pad, x0 - pad:x1 + 1 + pad]
dark = ~crop; H, W = dark.shape
lab = np.zeros(dark.shape, int); touches = [False]; n = 0
for y in range(H):
    for x in range(W):
        if dark[y, x] and not lab[y, x]:
            n += 1; t = False; q = deque([(y, x)]); lab[y, x] = n
            while q:
                a, b = q.popleft()
                if a in (0, H - 1) or b in (0, W - 1): t = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = a + dy, b + dx
                    if 0 <= yy < H and 0 <= xx < W and dark[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; q.append((yy, xx))
            touches.append(t)
# enclosed dark regions that vanish under a 5x5 erosion are the inline: fill them; keep anything thicker
er = np.asarray(Image.fromarray((dark * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 127
solid = crop.copy()
for i in range(1, n + 1):
    comp = lab == i
    if not touches[i] and not (er & comp).any(): solid |= comp
Image.fromarray((solid * 255).astype(np.uint8)).save(os.path.join(HERE, 'orig_mask.png'))
col = solid.sum(axis=0); segs = []; start = None
for x in range(W):
    if col[x] > 0 and start is None: start = x
    if col[x] == 0 and start is not None: segs.append((int(start + x0 - pad), int(x - 1 + x0 - pad))); start = None
json.dump({'x0': int(x0 - pad), 'y0': int(y0 - pad + Y0), 'w': int(W), 'h': int(H), 'pad': pad, 'letters': segs}, open(os.path.join(HERE, 'orig_meta.json'), 'w'))
print('letters', segs)
