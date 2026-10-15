// Regenerates derived images (resized photos, logo lockups, favicons, OG image) with ImageMagick.
// Run with: node src/build.mjs --assets   (only needed when the source photos or logo change)
// Source files (never modified): site/images/logo.png, logo-dark.png and the job photos.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const im = (...args) => execFileSync('convert', args.flat(), { stdio: 'inherit' });

export function makeAssets(root) {
  const img = join(root, 'site', 'images');
  const st = join(root, 'src', 'static');
  mkdirSync(st, { recursive: true });
  const I = (f) => join(img, f);
  const BLACK = '#0B0B0D';
  const PINK = '#F7096B';
  const jpg = ['-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', '78'];

  // --- Logo lockups: C5 symbol + "CLASS 5 / PROPERTY SERVICES LTD" side by side (header/footer) ---
  for (const [src, out] of [['logo.png', 'logo-lockup.png'], ['logo-dark.png', 'logo-lockup-dark.png']]) {
    const t = (n) => join(tmpdir(), `c5-${n}.png`);
    im(I(src), '-crop', '649x571+216+0', '+repage', t('sym'));
    im(I(src), '-crop', '986x126+21+653', '+repage', t('word'));
    im(I(src), '-crop', '1048x46+0+832', '+repage', '-trim', '+repage', '-resize', '986x', '-background', 'none', '-gravity', 'north', '-splice', '0x40', t('psl'));
    im(t('word'), t('psl'), '-background', 'none', '-append', '-resize', 'x330', '-gravity', 'west', '-splice', '70x0', t('text'));
    im(t('sym'), t('text'), '-background', 'none', '-gravity', 'center', '+append', '-resize', 'x112', '-strip', I(out));
  }
  // Square symbol on transparent (used in the 404 and about panels)
  im(I('logo.png'), '-crop', '649x571+216+0', '+repage', '-resize', '400x', '-strip', I('symbol.png'));

  // --- Favicons: symbol on black ---
  im('-size', '512x512', `xc:${BLACK}`, '(', I('logo.png'), '-crop', '649x571+216+0', '+repage', '-resize', '380x380', ')',
    '-gravity', 'center', '-composite', '-depth', '8', '-strip', join(st, 'favicon.png'));
  im(join(st, 'favicon.png'), '-resize', '180x180', join(st, 'apple-touch-icon.png'));
  im(join(st, 'favicon.png'), '-define', 'icon:auto-resize=48,32,16', join(st, 'favicon.ico'));
  im(join(st, 'favicon.png'), '-resize', '192x192', join(st, 'icon-192.png'));

  // --- OG image 1200x630: black, logo centred, pink accent bar ---
  im('-size', '1200x630', `xc:${BLACK}`,
    '(', I('logo.png'), '-resize', 'x430', ')', '-gravity', 'center', '-geometry', '+0-12', '-composite',
    '-fill', PINK, '-draw', 'rectangle 0,614 1200,630',
    ...jpg, '-quality', '86', join(st, 'og-default.jpg'));

  // --- Photos: responsive sizes ---
  const sizes = [
    ['class5-ute.jpg', 'ute', [1600, 800], []],
    ['fence-before.jpg', 'fence-before', [1600, 800], []],
    // after shot has a stray composite strip along the bottom: crop it off
    ['fence-after.jpg', 'fence-after', [1600, 800], ['-crop', '1920x695+0+0', '+repage']],
    // after shot cropped and scaled to line up with the before shot for the slider
    ['fence-after.jpg', 'fence-after-aligned', [1600, 800], ['-crop', '1300x430+225+262', '+repage']],
    ['new-fence-build.jpg', 'new-fence', [1200, 800], []],
    ['timber-gate.jpg', 'timber-gate', [900, 600], []],
  ];
  for (const [src, base, widths, pre] of sizes) {
    for (const w of widths) im(I(src), ...pre, '-resize', `${w}x`, ...jpg, I(`${base}-${w}.jpg`));
  }
}
