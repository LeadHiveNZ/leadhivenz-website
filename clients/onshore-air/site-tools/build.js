#!/usr/bin/env node
// Generates every page of the Onshore Air site from src/layout.js (shared shell) + src/pages/*.js
// (per-page content), plus sitemap.xml, robots.txt, netlify.toml, _redirects, site.webmanifest and the
// decorative waves.svg. Output goes straight into ../site, which is the Netlify publish folder.
// CSS (site/assets/css/site.css) and JS (site/assets/js/site.js) are hand-written; the build only
// fingerprints them (?v=hash) so the long-cache headers on /assets/* stay safe.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');
const ORDER = ['home', 'installations', 'repairs', 'hydro-cleaning', 'maintenance', 'about', 'service-areas', 'contact', 'thanks', '404'];
const write = (rel, content) => {
  const file = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return rel;
};

// Decorative wave lines (echo the logo's stripes) used behind navy sections.
function wavesSvg() {
  const lines = [];
  for (let i = 0; i < 13; i++) {
    const y = 30 + i * 46;
    const a = 26 + 12 * Math.sin(i * 0.7);
    const op = (0.10 + 0.13 * Math.sin((i / 12) * Math.PI)).toFixed(3);
    const col = i % 3 === 1 ? '#E49A2D' : (i % 2 ? '#3A6BC8' : '#5BB5D0');
    lines.push(`<path d="M-40 ${y} C 110 ${(y - a).toFixed(1)}, 250 ${(y + a).toFixed(1)}, 400 ${y} S 690 ${(y - a).toFixed(1)}, 840 ${y}" stroke="${col}" stroke-opacity="${op}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 620" fill="none" stroke-width="2.4" stroke-linecap="round">${lines.join('')}</svg>\n`;
}
write('assets/img/waves.svg', wavesSvg());

const L = require('./src/layout');
const S = L.S;
const pages = ORDER.filter((name) => fs.existsSync(path.join(__dirname, 'src', 'pages', `${name}.js`)))
  .map((name) => ({ name, ...require(`./src/pages/${name}.js`) }));
if (pages.length !== ORDER.length) console.warn('warning: missing page modules:', ORDER.filter((n) => !pages.find((p) => p.name === n)).join(', '));
const written = [];
for (const p of pages) written.push(write(p.out, L.page(p)));

// sitemap: indexable pages only
const today = new Date().toISOString().slice(0, 10);
const indexable = pages.filter((p) => !(p.robots || '').includes('noindex'));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((p) => `  <url><loc>${S.origin}${p.path}</loc><lastmod>${today}</lastmod><priority>${p.path === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${S.origin}/sitemap.xml
`);

// Old Wix URLs and *.html variants -> new clean routes (301). Netlify matches with or without a trailing slash.
// Includes every URL in the old Wix sitemap and blog feed so links and rankings carry over (first match wins,
// so the specific /post/ rules sit before the /post/* catch-all).
const redirects = [
  ['/cleaning', '/hydro-cleaning/'],
  ['/contact-8', '/contact/'],
  ['/home', '/'],
  ['/inquiry-services-page', '/contact/'],
  ['/blog', '/'],
  ['/blog/*', '/'],
  ['/post/professional-air-conditioner-cleaning-services-on-the-sunshine-coast', '/hydro-cleaning/'],
  ['/post/fast-reliable-air-conditioner-repairs-on-the-sunshine-coast', '/repairs/'],
  ['/post/expert-air-conditioning-installations-on-the-sunshine-coast', '/installations/'],
  ['/post/*', '/'],
  ...['installations', 'repairs', 'hydro-cleaning', 'maintenance', 'about', 'service-areas', 'contact'].map((r) => [`/${r}.html`, `/${r}/`]),
  ['/cleaning.html', '/hydro-cleaning/'],
  ['/contact-8.html', '/contact/'],
];
write('netlify.toml', `# Netlify config for a drag-and-drop deploy: this folder is the publish directory.
# Forms: the quote form uses Netlify Forms (data-netlify="true"); enable form detection in the site settings.

[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    Cross-Origin-Opener-Policy = "same-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/site.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
    Cache-Control = "public, max-age=86400"

${redirects.map(([from, to]) => `[[redirects]]
  from = "${from}"
  to = "${to}"
  status = 301
`).join('\n')}`);
write('_redirects', `# Same rules as netlify.toml (kept as a fallback for drag-and-drop deploys). First match wins.\n${redirects.map(([f, t]) => `${f.padEnd(78)} ${t.padEnd(18)} 301`).join('\n')}\n`);

write('site.webmanifest', JSON.stringify({
  name: S.name,
  short_name: S.name,
  description: 'Air conditioning installs, repairs, hydro cleaning and servicing across the Sunshine Coast.',
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#0C1D45',
  theme_color: '#0C1D45',
  icons: [
    { src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');

console.log(`built ${written.length} pages:\n  ${written.join('\n  ')}\n+ sitemap.xml robots.txt netlify.toml _redirects site.webmanifest assets/img/waves.svg`);
