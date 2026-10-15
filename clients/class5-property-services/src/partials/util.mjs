export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Responsive photo variants created by src/assets.mjs: [width, height] per size, largest first.
export const photos = {
  ute: [[1600, 1200], [800, 600]],
  'fence-before': [[1600, 530], [800, 265]],
  'fence-after': [[1600, 579], [800, 290]],
  'fence-after-aligned': [[1600, 529], [800, 265]],
  'new-fence': [[1200, 900], [800, 600]],
  'timber-gate': [[900, 1200], [600, 800]],
};

export function img(base, { alt, sizes = '100vw', cls = '', lazy = true, priority = false }) {
  const v = photos[base];
  if (!v) throw new Error(`Unknown photo ${base}`);
  const [w, h] = v[0];
  const srcset = v.map(([vw]) => `/images/${base}-${vw}.jpg ${vw}w`).join(', ');
  return `<img${cls ? ` class="${cls}"` : ''} src="/images/${base}-${w}.jpg" srcset="${srcset}" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async"${priority ? ' fetchpriority="high"' : ''}>`;
}
