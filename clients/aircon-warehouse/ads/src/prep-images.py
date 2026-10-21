# Builds ads/src/img/ from clients/aircon-warehouse/assets/. Run: python3 prep-images.py
from PIL import Image, ImageDraw, ImageFilter
import shutil
A='/home/user/leadhivenz-website/clients/aircon-warehouse/assets/'
O='/home/user/leadhivenz-website/clients/aircon-warehouse/ads/src/img/'
def debadge(src, dst, box, sample, pad=6):
    im = Image.open(src).convert('RGB')
    col = im.getpixel(sample)
    patch = im.copy()
    d = ImageDraw.Draw(patch)
    d.ellipse(box, fill=col)
    patch = patch.filter(ImageFilter.GaussianBlur(2))
    import numpy as np
    a = np.asarray(patch).astype(np.int16)
    n = np.random.default_rng(1).normal(0, 3.5, a.shape[:2])[..., None]
    patch = Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).ellipse((box[0]-pad, box[1]-pad, box[2]+pad, box[3]+pad), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(4))
    im.paste(patch, (0,0), mask)
    im.save(dst, quality=92)
    return im
debadge(A+'stock/living-room-heat-pump-1600.jpg', O+'living-room.jpg', (1066,132,1092,146), (1080,152), pad=4)
# (apartment-build.jpg is written below with the sign softened)
for f in ['logo-full-white.png','logo-mark.png']: shutil.copy(A+f, O+f)

# Builders photo: soften the third-party site sign (another company's name and phone number)
im = Image.open(A+'site-banner.jpg').convert('RGB')
box = (1000, 1062, 1114, 1158)
blur = im.filter(ImageFilter.GaussianBlur(7)).point(lambda v: int(v * .62))
mask = Image.new('L', im.size, 0)
ImageDraw.Draw(mask).rectangle(box, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
im.paste(blur, (0, 0), mask)
im.save(O+'apartment-build.jpg', quality=92)

# Trades photo (coordinator swap): clean indoor high-wall unit, no brand badge visible
shutil.copy(A+'stock/high-wall-unit-closeup-1600.jpg', O+'indoor-unit.jpg')
