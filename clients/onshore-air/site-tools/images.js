#!/usr/bin/env node
// Downloads Luke's original photos from Wix (cached in .cache/originals), crops and resizes them with
// ImageMagick, writes WebP + JPEG pairs to site/assets/img and records dimensions in src/image-manifest.json
// (the page generator reads it to set width/height on every <img>).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cfg = require('./images.config');

const ROOT = __dirname;
const CACHE = path.join(ROOT, '.cache', 'originals');
const OUT = path.join(ROOT, '..', 'site', 'assets', 'img');
const MANIFEST = path.join(ROOT, 'src', 'image-manifest.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const im = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 }).toString();
const only = process.argv.slice(2);
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

for (const p of cfg.photos) {
  if (only.length && !only.includes(p.name)) continue;
  const src = path.join(CACHE, p.id);
  if (!fs.existsSync(src) || fs.statSync(src).size < 1000) {
    process.stdout.write(`download ${p.id}\n`);
    execFileSync('curl', ['-sSL', '--fail', '-m', '120', '-A', UA, `https://static.wixstatic.com/media/${p.id}`, '-o', src]);
  }
  const [sw, sh] = im([`${src}[0]`, '-auto-orient', '-format', '%w %h', 'info:']).trim().split(' ').map(Number);
  // Largest rectangle of the requested aspect, centred on the focal point and clamped to the frame.
  let cw = sw, ch = sh, cx = 0, cy = 0;
  if (p.aspect) {
    const a = p.aspect[0] / p.aspect[1];
    if (sw / sh > a) { ch = sh; cw = Math.round(sh * a); } else { cw = sw; ch = Math.round(sw / a); }
    const [fx, fy] = p.focus || [0.5, 0.5];
    cx = Math.min(Math.max(Math.round(fx * sw - cw / 2), 0), sw - cw);
    cy = Math.min(Math.max(Math.round(fy * sh - ch / 2), 0), sh - ch);
  }
  const q = { ...cfg.quality, ...(p.quality || {}) };
  const entry = { widths: [], aspect: p.aspect ? `${p.aspect[0]}:${p.aspect[1]}` : null, source: p.id };
  for (const w of p.widths) {
    const h = Math.round(w * ch / cw);
    const base = path.join(OUT, `${p.name}-${w}`);
    const common = [`${src}[0]`, '-auto-orient', '-crop', `${cw}x${ch}+${cx}+${cy}`, '+repage', '-colorspace', 'sRGB',
      '-filter', 'Lanczos', '-resize', `${w}x${h}!`];
    if (w > cw) common.push('-unsharp', '0x0.8+0.6+0.02'); // upscaled variant: restore a little edge crispness
    im([...common, '-strip', '-quality', String(q.webp), '-define', 'webp:method=6', `${base}.webp`]);
    im([...common, '-strip', '-sampling-factor', '4:2:0', '-interlace', 'Plane', '-quality', String(q.jpg), `${base}.jpg`]);
    entry.widths.push(w);
    entry.w = w; entry.h = h; // largest variant's intrinsic size (widths are ascending)
    const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0);
    console.log(`${p.name}-${w}: ${w}x${h}  webp ${kb(base + '.webp')} KB  jpg ${kb(base + '.jpg')} KB`);
  }
  manifest[p.name] = entry;
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${Object.keys(manifest).length} images -> ${path.relative(process.cwd(), MANIFEST)}`);
