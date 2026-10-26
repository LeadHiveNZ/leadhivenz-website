// Build the multi-page, phone-first presentation site, download packs, PDF and screenshots.
// Usage: BRAND_OUT=.. SITE_OUT=../presentation SCREENS_OUT=../screens OLD_LOGO=../reference/current-logo.png node present/build-site.js
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const { build, CONCEPTS, OUT } = require('../build');
const { imgRef, imageRef, viewBox } = require('./parts');
const MK = require('./mockups');
const { getBrowser, close } = require('../lib/render');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.SITE_OUT ? path.resolve(process.env.SITE_OUT) : path.join(ROOT, 'site-out');
const SCREENS = process.env.SCREENS_OUT ? path.resolve(process.env.SCREENS_OUT) : path.join(ROOT, 'screens-out');
const OLD_LOGO = process.env.OLD_LOGO ? path.resolve(process.env.OLD_LOGO) : path.join(ROOT, 'reference', 'current-logo.png');
const DATE = '26 October 2026';
const PAGES = [
  { file: 'index.html', nav: 'Overview' },
  { file: 'concept-1.html', nav: 'Concept 1' },
  { file: 'concept-2.html', nav: 'Concept 2' },
  { file: 'concept-3.html', nav: 'Concept 3' },
  { file: 'compare.html', nav: 'Compare' },
  { file: 'guidelines.html', nav: 'Guidelines' },
];

// ---------- data ----------
const lum = hex => { const c = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = hex => hex.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(' ');
const RATIONALE = {
  evolution: ['This is the sun-meets-sea sphere Onshore Air already owns, rebuilt as four flat bands so it prints, embroiders and still reads as a favicon.',
    'The diagonal S-split tells the product story at a glance: Sunshine Coast heat in the bottom-left, cool ocean air in the top-right.',
    'Paired with a heavy, round-shouldered Outfit wordmark, it looks like the same company, grown up.'],
  horizon: ['The sun sits on a single line that is both the coastline horizon and the onshore breeze. It runs flat under the sun, then sweeps up the right side and tapers away like a gust of sea air.',
    'Inside the sun, the warm/cool split is kept as sun over sea, and the whole mark uses only two main colours plus an ocean-blue accent.',
    'Set in a wide-tracked Sora wordmark, it has the calm restraint of an OEM dealer badge and is the most premium of the three in large formats.'],
  monogram: ['A navy O, the initial of Onshore, frames the original diagonal sun-meets-sea split: warm bottom-left, cool top-right.',
    'It is the simplest, sturdiest silhouette of the three, so it holds up at 16 px, on a cap and as a Google avatar.',
    'The Red Hat Display Black wordmark adds corporate weight. The trade-off is that the ring makes it read more like a badge than a personality.'],
};
const FONTS = { evolution: ['Outfit ExtraBold', 'Outfit SemiBold'], horizon: ['Sora Bold', 'Sora SemiBold'], monogram: ['Red Hat Display Black', 'Red Hat Display Bold'] };
const SUMMARY = { evolution: 'Today\'s sun-and-sea sphere, grown up. Recommended.', horizon: 'The sun on a horizon line that sweeps round it like a breeze.', monogram: 'A navy O holding the diagonal sun-meets-sea split.' };
const TILES2 = [
  ['primary-stacked.svg', 'Stacked logo', 'w big', 'lg-stacked'], ['primary-stacked-on-navy.svg', 'Stacked logo, for navy backgrounds', 'n big', 'lg-stacked'],
  ['horizontal.svg', 'Horizontal, with descriptor', 'w', 'lg-horiz'], ['horizontal-on-navy.svg', 'Horizontal, for navy backgrounds', 'n', 'lg-horiz']];
const TILES4 = [
  ['icon.svg', 'Icon', 'w', 'lg-icon'], ['icon-on-navy.svg', 'Icon, for navy backgrounds', 'n', 'lg-icon'],
  ['mono-navy.svg', 'One-colour, for embroidery (navy)', 'w', 'lg-mono'], ['mono-white.svg', 'One-colour, for embroidery (white)', 'n', 'lg-mono'],
  ['wordmark.svg', 'Name only', 'w', 'lg-word'], ['horizontal-compact.svg', 'Compact horizontal, for small spaces', 'w', 'lg-compact'],
  ['horizontal-compact-on-navy.svg', 'Compact, for navy backgrounds', 'n', 'lg-compact'], ['icon-app.svg', 'Google and social avatar', 'g', 'lg-app']];
const zipName = r => `onshore-air-${r.cfg.id}.zip`;
const ALLZIP = 'onshore-air-logo-concepts-all.zip', PDF = 'onshore-air-logo-presentation.pdf';
const human = b => b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';

// ---------- templates ----------
function page({ file, title, desc, body, cnavy }) {
  const nav = PAGES.map(p => `<a href="${p.file}"${p.file === file ? ' class="on" aria-current="page"' : ''}>${p.nav}</a>`).join('');
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="icon" href="assets/concept-1/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="styles.css">
</head>
<body style="background:#f5f6f8">
<header class="topnav"><nav aria-label="Presentation pages">${nav}</nav></header>
<main class="wrap"${cnavy ? ` style="--cnavy:${cnavy}"` : ''}>
${body}
</main>
<footer>Prepared by LeadHive AU for Onshore Air · ${DATE} · Concepts are original artwork; typefaces are licensed under the SIL Open Font Licence.</footer>
</body>
</html>
`;
}
const img = (r, f, cls, alt) => imgRef(r.url(f), r.files[f], { cls, alt: alt || `${r.cfg.title}: ${f}` });
const tile = (r, [f, label, kind, cls]) => `<figure class="tile ${kind}"><div class="art">${img(r, f, cls, label)}</div><figcaption><b>${label}</b><span>${f}</span></figcaption></figure>`;
const swatches = r => r.cfg.colours.map(c => {
  const onW = cr(c.hex, '#FFFFFF'), onN = cr(c.hex, r.P.navy);
  let note;
  if (c.role === 'navy') note = `White text on it ${cr('#FFFFFF', c.hex).toFixed(1)}:1 (AAA). Type and backgrounds`;
  else if (onW >= 4.5) note = `Text-safe on white ${onW.toFixed(1)}:1`;
  else if (onW >= 3) note = `Large type on white ${onW.toFixed(1)}:1 · on navy ${onN.toFixed(1)}:1`;
  else note = `On navy ${onN.toFixed(1)}:1 · accent only on white`;
  return `<div class="sw" style="background:${c.hex};color:${lum(c.hex) < 0.25 ? '#fff' : '#0B1F5C'}"><b>${c.name}</b><span>${c.hex}</span><span>RGB ${rgb(c.hex)}</span><em>${note}</em></div>`;
}).join('') + `<div class="sw" style="background:#fff;color:#0B1F5C;border:1px solid #dde1e8"><b>White</b><span>#FFFFFF</span><span>RGB 255 255 255</span><em>Clear space and reversed artwork</em></div>`;

// ---------- page bodies ----------
function indexBody(R, sizes) {
  const [e] = R;
  return `
<section class="cover">
  <div class="eyebrow">Logo refresh · Concepts for review</div>
  <h1>Onshore Air</h1>
  <p>Three logo concepts for the Sunshine Coast's air-conditioning specialists. Each keeps the sun-meets-sea idea Luke already owns, rebuilt as a modern logo system that holds up on a 6 m van and at 16 px in a browser tab.</p>
  <div class="icons">${R.map(r => img(r, 'icon-on-navy.svg', '', `Concept ${r.n} icon`)).join('')}</div>
  <div class="meta"><span><b>Client</b> Onshore Air, Pacific Paradise QLD</span><span><b>Prepared by</b> LeadHive AU</span><span><b>Date</b> ${DATE}</span></div>
</section>

<section id="strategy">
  <div class="eyebrow">Strategy</div>
  <h2>Hot outside, cool inside. Told once, simply.</h2>
  <div class="cols2">
    <div>
      <p>Blue owns Australian air conditioning: 13 of the 15 brands we audited lead with blue. Red is the OEM accent, and local installers default to snowflakes, swooshes and the same stock fonts. Nobody owns the coastal warm-to-cool story, and Onshore Air's sun-meets-sea sphere already tells it.</p>
      <p>The job is to keep that idea and make it professional: flat shapes, a confident name in a strong typeface, and a complete set of files.</p>
    </div>
    <ol class="tight">
      <li>Keep the circular sun/sea symbol and its warm/cool split. It is what people already recognise, and it describes the product.</li>
      <li>Rebuild it as flat shapes: no gradients or hairlines, with gaps wide enough to embroider.</li>
      <li>Lead with deep navy. Make sun-gold the signature and ocean blue the cool counterpoint.</li>
      <li>Replace the outlined lettering with a heavy, easy-to-read typeface.</li>
      <li>Ship every version needed, from the van to the browser tab.</li>
    </ol>
  </div>
  <div class="keepfix">
    <div><h3>What we keep</h3><ul><li>The circle: sun, sea and air in one shape</li><li>The warm-versus-cool split</li><li>Navy, yellow/gold and ocean blue</li></ul></div>
    <div><h3>What we fix</h3><ul><li>Outlined lettering that is hard to read</li><li>Gradient stripes that cannot be embroidered or printed in one colour</li><li>No small, horizontal, one-colour or reversed versions, and no spacing rules</li></ul></div>
  </div>
</section>

<section id="before-after">
  <div class="eyebrow">Before and after</div>
  <h2>Same idea, three ways forward</h2>
  <p>The current logo (left), as supplied, beside the three concepts, each on its own navy as it would appear in the website header. Concept 1 keeps today's diagonal sun-meets-sea split most directly, which is why it is our recommendation.</p>
  <div class="before">
    <div class="bcell old"><img src="assets/current-logo.png" alt="Current Onshore Air logo" width="420" height="335"><label>Current logo</label></div>
    ${R.map(r => `<a class="bcell" href="concept-${r.n}.html" style="--cnavy:${r.P.navy}">${r.n === 1 ? '<span class="badge">Recommended</span>' : ''}${img(r, 'primary-stacked-on-navy.svg', 'lg', `Concept ${r.n}, ${r.cfg.title}`)}<label>${r.n} · ${r.cfg.title}</label></a>`).join('')}
  </div>
</section>

<section id="how-to-choose">
  <div class="howto">
    <h3>How to choose</h3>
    <p>Don't judge them only as logos on a white page. Open each concept and look at it on the van, the polo and your Google listing, or use <a href="compare.html">Compare</a> to see all three side by side. Pick the one that still feels like Onshore when it is small, far away or moving past. It's fine to say "this one, but with that colour". Mixing is part of the refinement round.</p>
  </div>
</section>

<section class="reco" id="recommendation">
  <div class="eyebrow">Recommendation</div>
  <h2>Go with Concept 1, Evolution</h2>
  <div class="win">
    <a class="lg" href="concept-1.html">${img(e, 'primary-stacked.svg', '', 'Concept 1, Evolution, stacked logo')}</a>
    <div>
      <ol>
        <li><b>It keeps the identity Onshore already has.</b> Customers already know the diagonal sun-meets-sea split from the van, the shirts and the Google listing. Evolution is the only concept that keeps it as the whole mark, so the refresh reads as an upgrade, not a rebrand.</li>
        <li><b>It has the most personality.</b> Four flat colours carry on a van at distance and stand out in a social feed or a Maps list, where most trades are blue on white.</li>
        <li><b>It passes the practical tests.</b> The favicon cut reads at 16 px and the embroidery cut has widened gaps. Every lockup has one-colour and on-navy versions.</li>
        <li><b>Its trade-offs are manageable.</b> It is the most colourful of the three, so one-colour jobs use the mono files, and at the very smallest sizes the bands read by colour rather than by shape.</li>
      </ol>
      <div class="actions"><a class="btn gold" href="downloads/${zipName(e)}">Download the Evolution pack <small>${sizes[zipName(e)] || ''}</small></a><a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" href="concept-1.html">See Concept 1 in use</a></div>
    </div>
  </div>
  <p class="alt"><b>Runner-up: Concept 3, Monogram</b>, for a client who wants maximum simplicity. It is technically the safest at small sizes, and its O now carries the diagonal split. But the ring dominates, and the overall silhouette reads as generic, a porthole or a bank badge that could belong to any company. Its small-size advantage is real, but Evolution already passes the 16 px test with its favicon cut.</p>
  <p class="alt" style="border-top:0;margin-top:0;padding-top:0"><b>Concept 2, Horizon</b> is the premium outlier: the most refined at large sizes, but the least connected to the logo customers know today.</p>
</section>

<section class="next" id="next">
  <div class="eyebrow">Next steps</div>
  <h2>What we need from Luke</h2>
  <ol>
    <li>Confirm the direction. We recommend Evolution, and elements can be mixed, for example Monogram's heavier wordmark with the Evolution mark.</li>
    <li>One round of refinements on the chosen concept (colour, weight, descriptor wording).</li>
    <li>Final artwork: master SVG files, print PDFs with CMYK values proofed by the printer, an embroidery file digitised from the one-colour artwork, and the van wrap scaled from SVG.</li>
  </ol>
  <div class="actions"><a class="btn navy" href="downloads/${PDF}">Download this presentation as a PDF <small>${sizes[PDF] || ''}</small></a><a class="btn ghost" href="guidelines.html#downloads">All downloads</a></div>
</section>

<section id="explore">
  <div class="eyebrow">Explore</div>
  <h2>Every page</h2>
  <div class="navgrid">
    ${R.map(r => `<a class="navcard" href="concept-${r.n}.html">${img(r, 'icon.svg', '', '')}<div><b>Concept ${r.n} · ${r.cfg.title}</b><span>${SUMMARY[r.cfg.slug]} Logo files, colours and mockups.</span></div></a>`).join('')}
    <a class="navcard" href="compare.html"><span class="ph">⇆</span><div><b>Compare</b><span>All three side by side on the van, polo, Google profile, phone, business card and browser tab.</span></div></a>
    <a class="navcard" href="guidelines.html"><span class="ph">↓</span><div><b>Guidelines and downloads</b><span>Clear space, minimum sizes, which file to use for what, and the download packs.</span></div></a>
  </div>
</section>`;
}

function conceptBody(R, r, sizes) {
  const prev = R[(r.n + 1) % 3], next = R[r.n % 3];
  const f = r.files;
  return `
<section id="about" class="keep">
  <div class="chead"><div class="cnum">0${r.n}</div><div><div class="eyebrow">Concept ${r.n}${r.n === 1 ? '<span class="badge inline">Recommended</span>' : ''}</div><h2>${r.cfg.title}</h2></div></div>
  <div class="crat">${RATIONALE[r.cfg.slug].map(x => `<p>${x}</p>`).join('')}</div>
  <div class="palette">${swatches(r)}</div>
  <p class="fontnote"><b>Type</b> ${FONTS[r.cfg.slug][0]} (name) · ${FONTS[r.cfg.slug][1]} (descriptor) · Google Fonts, SIL Open Font Licence. All lettering is converted to outlines, so the files never depend on installed fonts.</p>
  <div class="actions"><a class="btn navy" href="downloads/${zipName(r)}">Download the ${r.cfg.title} pack <small>${sizes[zipName(r)] || ''}</small></a></div>
</section>

<section id="files">
  <div class="eyebrow">The logo files</div>
  <h2>Every version, on white and on navy</h2>
  <div class="grid2">${TILES2.map(t => tile(r, t)).join('')}</div>
  <div class="grid4">${TILES4.map(t => tile(r, t)).join('')}</div>
</section>

<section id="small" class="keep">
  <div class="eyebrow">Small sizes</div>
  <h2>Still clear at 16 pixels</h2>
  <div class="srow">
    <div class="sblock"><div class="demo sizes">${[16, 24, 32, 48].map(z => `<img src="${r.url('favicon.svg')}" width="${z}" height="${z}" alt="favicon at ${z} px">`).join('')}</div><label>Browser-tab icon at 16 / 24 / 32 / 48 px<br><code>favicon.svg</code></label></div>
    <div class="sblock dark"><div class="demo sizes">${[16, 24, 32, 48].map(z => `<img src="${r.url('favicon-dark-preview.svg')}" width="${z}" height="${z}" alt="favicon at ${z} px, dark browser">`).join('')}</div><label>On a dark browser bar: the navy switches to white automatically</label></div>
    <div class="sblock"><div class="demo zoom"><img src="${r.url('icon-master-16.png')}" width="96" height="96" alt="Master icon at 16 px, zoomed"><img src="${r.url('icon-16.png')}" width="96" height="96" alt="Favicon cut at 16 px, zoomed"></div><label>16 px pixels, zoomed 6×: master icon (left) and the small-size cut (right)</label></div>
    <div class="sblock"><div class="demo at120">${img(r, 'horizontal.svg', '', 'Horizontal logo at 120 px')}${img(r, 'horizontal-compact.svg', '', 'Compact logo at 120 px')}</div><label>Horizontal and compact logos at 120 px wide. Use the compact one below 240 px</label></div>
  </div>
</section>

<section id="in-use">
  <div class="eyebrow">In use</div>
  <h2>${r.cfg.title} in the real world</h2>
  <p class="intro">On the van, a polo, the Google listing, the website on a phone, a business card and a browser tab.</p>
  <div class="vrow">${MK.van(r)}</div>
  <div class="usegrid">
    <div class="cell">${MK.polo(r)}</div>
    <div class="cell">${MK.gbp(r)}</div>
    <div class="cell">${MK.phone(r)}</div>
    <div class="cell">${MK.card(r)}</div>
  </div>
  <div class="browsers">${MK.tabs([r], false, { single: true })}${MK.tabs([r], true, { single: true })}</div>
</section>

<section class="flush">
  <nav class="pager" aria-label="Other concepts">
    <a href="concept-${prev.n}.html"><small>Previous concept</small><b>‹ ${prev.n} · ${prev.cfg.title}</b></a>
    <a class="nextp" href="concept-${next.n}.html"><small>Next concept</small><b>${next.n} · ${next.cfg.title} ›</b></a>
  </nav>
</section>`;
}

function compareBody(R) {
  const sec = (id, title, intro, inner) => `<section id="${id}"${id === 'van' ? '' : ' class="keep"'}><div class="eyebrow">Compare</div><h2>${title}</h2><p class="intro">${intro}</p>${inner}</section>`;
  return `
<section id="compare-intro"><div class="eyebrow">Compare</div><h2>All three, side by side</h2><p>The same six real-world uses for every concept, so the choice is about how each one feels on the job, not on a white page. Concept 1, Evolution, is our recommendation.</p></section>
${sec('van', 'On the road', 'A white van side panel: the horizontal logo, phone number and website on the cargo panel, the licence and icon on the cab door, and the services in a navy skirt.', `<div class="vans">${R.map(r => `<div class="vrow"><label>${r.n} · ${r.cfg.title}</label>${MK.van(r)}</div>`).join('')}</div>`)}
${sec('polo', 'On the team', 'A navy polo with the one-colour white logo embroidered on the left chest, about 70 mm wide.', `<div class="polos">${R.map(r => `<div class="prow"><label>${r.n} · ${r.cfg.title}</label>${MK.polo(r)}</div>`).join('')}</div>`)}
${sec('gbp', 'On Google', 'The Google Business Profile picture is cropped to a circle and often seen at 32 px in Maps.', `<div class="gbps">${R.map(r => `<div class="lab"><div class="eyebrow">${r.n} · ${r.cfg.title}</div>${MK.gbp(r)}</div>`).join('')}</div>`)}
${sec('phone', 'On the website', 'A mobile header on navy, using the compact horizontal logo at 30 px high.', `<div class="phones">${R.map(r => `<div class="lab"><div class="eyebrow">${r.n} · ${r.cfg.title}</div>${MK.phone(r)}</div>`).join('')}</div>`)}
${sec('card', 'In the hand', 'Business card, front and back, 90 × 55 mm.', `<div class="cardsgrid">${R.map(r => `<div class="crow"><div class="eyebrow">${r.n} · ${r.cfg.title}</div>${MK.card(r)}</div>`).join('')}</div>`)}
${sec('tab', 'In the browser', 'Browser-tab icons at their real size in light and dark browsers, one tab per concept.', '<div class="browsers">' + MK.tabs(R) + MK.tabs(R, true) + '</div>')}`;
}

function clearSpace(r) {
  const svg = r.files['horizontal.svg']; const [, , W, H] = viewBox(svg);
  const X = 100, p = 50, ax = p, ay = p, aw = W - 2 * p, ah = H - 2 * p, cx = ax - X, cy = ay - X, cw = aw + 2 * X, ch = ah + 2 * X, m = 40;
  const logo = imageRef(r.url('horizontal.svg'), svg, 0, 0, { w: W });
  const sq = (x, y) => `<rect x="${x}" y="${y}" width="${X}" height="${X}" fill="#fde7ee" stroke="#e0567a" stroke-width="3"/><text x="${x + X / 2}" y="${y + X / 2 + 16}" text-anchor="middle" font-size="46" font-family="Inter,Arial,sans-serif" fill="#e0567a" font-weight="600">x</text>`;
  return `<svg viewBox="${cx - m} ${cy - m} ${cw + 2 * m} ${ch + 2 * m}" class="cs" role="img" aria-label="Clear space around the ${r.cfg.title} horizontal logo">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#eef3fb"/>
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="#8d9bb8" stroke-width="3" stroke-dasharray="14 10"/>
    <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#c9d2e3" stroke-width="2"/>
    ${logo.svg}${sq(cx, cy)}${sq(ax + aw, cy)}${sq(cx, ay + ah)}${sq(ax + aw, ay + ah)}</svg>`;
}

function guidelinesBody(R, sizes) {
  const row = (label, file, screen, print, use) => `<tr><td>${label}<small>${file}</small></td><td data-label="Screen">${screen}</td><td data-label="Print">${print}</td><td data-label="Use it for">${use}</td></tr>`;
  const dl = (file, title, desc) => `<a href="downloads/${file}" download><b>${title}</b><span>${desc}</span><em>Download · ${sizes[file] || ''}</em></a>`;
  return `
<section id="clear-space">
  <div class="eyebrow">Guidelines</div>
  <h2>Clear space</h2>
  <p>Leave a gap of <b>x</b> on every side, where x is the height of the capital letters in ONSHORE. Nothing else (text, photos, the edge of a van panel) goes inside the dashed line. The supplied files already include half of that gap.</p>
  <div class="csgrid">${R.map(r => `<div class="csbox">${clearSpace(r)}<label>${r.n} · ${r.cfg.title}</label></div>`).join('')}</div>
</section>

<section id="sizes">
  <div class="eyebrow">Guidelines</div>
  <h2>Smallest sizes</h2>
  <table class="mins">
    <thead><tr><th>Logo</th><th>Smallest on screen</th><th>Smallest in print</th><th>Use it for</th></tr></thead>
    <tbody>
      ${row('Horizontal, with descriptor', 'horizontal.svg', '240 px wide', '60 mm wide', 'Van side, signage, invoices, email signature, website header on a computer')}
      ${row('Compact horizontal', 'horizontal-compact.svg', '120 px wide', '30 mm wide', 'Website header on a phone, social banners, small print')}
      ${row('Stacked logo', 'primary-stacked.svg', '120 px wide', '25 mm wide', 'Business cards, square social posts, shirts and signs where space is square')}
      ${row('One-colour, for embroidery', 'mono-navy.svg · mono-white.svg', 'n/a', '60 mm wide (polo chest), 50 mm (cap front)', 'Embroidery, engraving, one-colour print, van magnets')}
      ${row('Icon and avatar', 'icon.svg · icon-app.svg', '64 px', '8 mm', 'Google Business Profile, Facebook and Instagram pictures')}
      ${row('Browser-tab icon', 'favicon.svg', '16–48 px', 'n/a', 'Browser tab and bookmarks. It turns its navy white in dark browsers')}
    </tbody>
  </table>
</section>

<section id="which-file">
  <div class="eyebrow">Guidelines</div>
  <h2>Which file do I use?</h2>
  <p>The file names are the same in every concept pack.</p>
  <div class="which">
    <div><b>Van wrap or sign</b>Send the signwriter <code>horizontal.svg</code>. It is a vector file and scales to any size; never enlarge a PNG. Use <code>horizontal-mono-navy.svg</code> for one-colour cut vinyl.</div>
    <div><b>Polos and caps (embroidery)</b>Send the embroiderer <code>mono-white.svg</code> for navy shirts, or <code>mono-navy.svg</code> for white or light shirts. Ask for a sew-out sample first.</div>
    <div><b>Google, Facebook, Instagram picture</b>Upload <code>png/icon-app-512.png</code>. The platforms crop it to a circle and it is designed for that.</div>
    <div><b>Website</b><code>horizontal-on-navy.svg</code> in the header on a computer, <code>horizontal-compact-on-navy.svg</code> on a phone. Your web person will know what to do with these.</div>
    <div><b>Invoices, quotes and email signature</b><code>horizontal.svg</code>, or <code>png/horizontal@2x.png</code> where the software will not take SVG.</div>
    <div><b>Browser tab (favicon)</b><code>favicon.svg</code>, plus <code>png/icon-32.png</code> as a fallback and <code>png/icon-app-180.png</code> for iPhones.</div>
    <div><b>Business cards</b><code>primary-stacked.svg</code> on the front, <code>icon-on-navy.svg</code> on a navy back.</div>
    <div><b>One-colour jobs (stamps, engraving)</b>The <code>mono-</code> and <code>icon-mono-</code> files, in navy or white.</div>
  </div>
</section>

<section id="downloads">
  <div class="eyebrow">Downloads</div>
  <h2>Download packs</h2>
  <p>Each pack has every SVG file, PNG versions at 2× and icon sizes, and a one-page README with the colours, font, minimum sizes and which file to use for what.</p>
  <div class="dl">
    ${dl(zipName(R[0]), 'Concept 1, Evolution (recommended)', `${zipName(R[0])} · SVG + PNG + README`)}
    ${dl(zipName(R[1]), 'Concept 2, Horizon', `${zipName(R[1])} · SVG + PNG + README`)}
    ${dl(zipName(R[2]), 'Concept 3, Monogram', `${zipName(R[2])} · SVG + PNG + README`)}
    ${dl(ALLZIP, 'All three concepts', `${ALLZIP} · the three packs in one file`)}
    ${dl(PDF, 'This presentation as a PDF', `${PDF} · A4, every page in order`)}
  </div>
</section>`;
}

// ---------- packs ----------
function readme(r) {
  const c = r.cfg, pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  return [
    `ONSHORE AIR · LOGO CONCEPT ${r.n}: ${c.title.toUpperCase()}${r.n === 1 ? '  (recommended)' : ''}`,
    `Concept files · ${DATE} · prepared by LeadHive AU`, '',
    'COLOURS',
    ...c.colours.map(k => `  ${pad(k.name, 15)} ${k.hex}   RGB ${rgb(k.hex)}`),
    '  White           #FFFFFF   RGB 255 255 255',
    '  Print: ask the printer to match these hex values on your stock (CMYK not yet proofed).', '',
    'FONT',
    `  Name: ${FONTS[c.slug][0]}. Descriptor: ${FONTS[c.slug][1]}. Google Fonts, SIL Open Font Licence.`,
    '  All lettering is converted to outlines, so no font needs to be installed.', '',
    'WHICH FILE FOR WHAT',
    '  Van wrap / signs ........... horizontal.svg (vector, scale to any size)',
    '  One-colour vinyl ........... horizontal-mono-navy.svg / horizontal-mono-white.svg',
    '  Embroidery (polos, caps) ... mono-white.svg on navy shirts, mono-navy.svg on light shirts',
    '  Google / Facebook picture .. png/icon-app-512.png',
    '  Website header ............. horizontal-on-navy.svg (computer), horizontal-compact-on-navy.svg (phone)',
    '  Browser tab (favicon) ...... favicon.svg + png/icon-32.png + png/icon-app-180.png (iPhone)',
    '  Invoices / email ........... horizontal.svg, or png/horizontal@2x.png',
    '  Business cards ............. primary-stacked.svg (front), icon-on-navy.svg (back)',
    '  On navy backgrounds ........ any file ending in -on-navy, or the mono-white files', '',
    'SMALLEST SIZES',
    '  Horizontal, with descriptor   240 px on screen / 60 mm in print',
    '  Compact horizontal            120 px / 30 mm',
    '  Stacked logo                  120 px / 25 mm',
    '  Embroidery (mono files)       60 mm wide on a polo chest, 50 mm on a cap',
    '  Icon                          64 px / 8 mm (favicon.svg is drawn for 16-48 px)', '',
    'CLEAR SPACE',
    '  Leave a gap equal to the height of the capital letters in ONSHORE on every side.', '',
    'DON\'T recolour, stretch, add shadows or outlines, or put the colour logo on a busy photo.', '',
  ].join('\r\n');
}
function makeZips(R) {
  const D = path.join(SITE, 'downloads'), stage = path.join(D, '_stage');
  fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
  for (const r of R) {
    const dir = path.join(stage, `onshore-air-${r.cfg.id}`);
    execSync(`mkdir -p "${dir}" && cp "${path.join(OUT, r.cfg.id)}"/*.svg "${dir}/" && cp -r "${path.join(OUT, r.cfg.id, 'png')}" "${dir}/png"`);
    fs.writeFileSync(path.join(dir, 'README.txt'), readme(r));
  }
  fs.writeFileSync(path.join(stage, 'README.txt'), ['ONSHORE AIR · LOGO CONCEPTS (ALL THREE)', `Concepts for review · ${DATE} · prepared by LeadHive AU`, '',
    'Concept 1, Evolution (recommended) · Concept 2, Horizon · Concept 3, Monogram', 'Each folder has its own README.txt with colours, font, sizes and which file to use.', ''].join('\r\n'));
  execSync(`find "${stage}" -exec touch -h -d "2026-10-26 09:00:00" {} +`);
  for (const r of R) { const z = path.join(D, zipName(r)); fs.rmSync(z, { force: true }); execSync(`cd "${stage}" && zip -q -r -X -9 "${z}" "onshore-air-${r.cfg.id}"`); }
  const all = path.join(D, ALLZIP); fs.rmSync(all, { force: true });
  execSync(`cd "${stage}" && zip -q -r -X -9 "${all}" README.txt ${R.map(r => `"onshore-air-${r.cfg.id}"`).join(' ')}`);
  fs.rmSync(stage, { recursive: true, force: true });
}

// ---------- write ----------
function writeAssets(R) {
  for (const r of R) {
    const d = path.join(SITE, 'assets', `concept-${r.n}`); fs.mkdirSync(d, { recursive: true });
    for (const [f, svg] of Object.entries(r.files)) if (!f.startsWith('_')) fs.writeFileSync(path.join(d, f), svg);
    fs.writeFileSync(path.join(d, 'favicon-dark-preview.svg'), r.files['_favicon-dark-preview']);
    for (const p of ['icon-16.png', 'icon-master-16.png']) fs.copyFileSync(path.join(OUT, r.cfg.id, 'png', p), path.join(d, p));
  }
  execSync(`convert "${OLD_LOGO}" -resize 420x -strip "${path.join(SITE, 'assets', 'current-logo.png')}"`);
  fs.copyFileSync(path.join(__dirname, 'site', 'styles.css'), path.join(SITE, 'styles.css'));
}
function writePages(R, sizes) {
  const meta = {
    'index.html': ['Onshore Air Logo Refresh', 'Three logo concepts for Onshore Air, air conditioning on the Sunshine Coast, with our recommendation.', null, () => indexBody(R, sizes)],
    'compare.html': ['Compare Concepts · Onshore Air', 'The three Onshore Air logo concepts side by side on a van, polo, Google profile, phone, business card and browser tab.', null, () => compareBody(R)],
    'guidelines.html': ['Logo Guidelines · Onshore Air', 'Clear space, minimum sizes, which file to use and download packs for the Onshore Air logo concepts.', null, () => guidelinesBody(R, sizes)],
  };
  for (const r of R) meta[`concept-${r.n}.html`] = [`Concept ${r.n}, ${r.cfg.title} · Onshore Air`, `Onshore Air logo concept ${r.n}, ${r.cfg.title}: rationale, colours, every logo file, small-size tests and mockups.`, r.P.navy, () => conceptBody(R, r, sizes)];
  for (const p of PAGES) { const [title, desc, cnavy, body] = meta[p.file]; fs.writeFileSync(path.join(SITE, p.file), page({ file: p.file, title, desc, body: body(), cnavy })); }
}
async function makePdf() {
  const b = await getBrowser(); const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'onshore-pdf-')); const parts = [];
  for (const p of PAGES) {
    const pg = await b.newPage({ viewport: { width: 794, height: 1123 } });
    await pg.goto('file://' + path.join(SITE, p.file), { waitUntil: 'load' }); await pg.waitForTimeout(150);
    const f = path.join(tmp, p.file.replace('.html', '.pdf'));
    await pg.pdf({ path: f, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
    parts.push(f); await pg.close();
  }
  const out = path.join(SITE, 'downloads', PDF);
  execSync(`pdfunite ${parts.map(x => `"${x}"`).join(' ')} "${out}"`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
async function screenshots(R) {
  const b = await getBrowser(); const S = path.join(SITE, 'screens'); fs.mkdirSync(S, { recursive: true });
  for (const p of PAGES) {
    const name = p.file.replace('.html', '');
    for (const [kind, vp, opts] of [['mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['desktop', { width: 1280, height: 900 }, {}]]) {
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, ...opts }); const pg = await ctx.newPage();
      await pg.goto('file://' + path.join(SITE, p.file), { waitUntil: 'load' }); await pg.waitForTimeout(200);
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
      if (sw > vp.width) console.warn(`WARNING ${p.file} ${kind}: horizontal overflow ${sw}px > ${vp.width}px`);
      await pg.screenshot({ path: path.join(S, `${name}-${kind}.png`), fullPage: true });
      await ctx.close();
    }
  }
  // brand/screens: concept sheets and mockup sheets at desktop width, 2x
  fs.mkdirSync(SCREENS, { recursive: true });
  const shots = [...R.map(r => [`concept-${r.n}.html`, ['#about', '#files', '#small'], `concept-${r.n}.png`]),
    ...['van', 'polo', 'gbp', 'phone', 'card', 'tab'].map(id => ['compare.html', '#' + id, `mock-${id}.png`]),
    ['guidelines.html', '#clear-space', 'rules.png'], ['index.html', '#strategy', 'strategy.png'],
    ['index.html', '#before-after', 'before-after.png'], ['index.html', '#recommendation', 'recommendation.png']];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  for (const [file, sel, out] of shots) {
    const pg = await ctx.newPage(); await pg.goto('file://' + path.join(SITE, file), { waitUntil: 'load' });
    await pg.addStyleTag({ content: '.topnav{display:none!important}' }); await pg.waitForTimeout(150);   // no sticky nav over element shots
    if (Array.isArray(sel)) {        // union of several sections, e.g. a whole concept board
      const boxes = await Promise.all(sel.map(async s => (await pg.$(s)).boundingBox()));
      const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
      const w = Math.max(...boxes.map(b => b.x + b.width)) - x, h = Math.max(...boxes.map(b => b.y + b.height)) - y;
      await pg.screenshot({ path: path.join(SCREENS, out), fullPage: true, clip: { x, y, width: w, height: h } });
    } else await (await pg.$(sel)).screenshot({ path: path.join(SCREENS, out) });
    await pg.close();
  }
  await ctx.close();
}

(async () => {
  const R = CONCEPTS.map((cfg, i) => { const r = build(cfg); r.n = i + 1; r.url = f => `assets/concept-${i + 1}/${f}`; return r; });
  fs.mkdirSync(path.join(SITE, 'downloads'), { recursive: true });
  writeAssets(R);
  makeZips(R);
  const sizes = {}; const measure = () => { for (const f of fs.readdirSync(path.join(SITE, 'downloads'))) sizes[f] = human(fs.statSync(path.join(SITE, 'downloads', f)).size); };
  measure();
  writePages(R, sizes); await makePdf(); measure();          // pass 1: PDF without its own size
  writePages(R, sizes); await makePdf();                     // pass 2: pages show final sizes
  const before = sizes[PDF]; measure();
  if (sizes[PDF] !== before) { writePages(R, sizes); await makePdf(); measure(); }
  if (!process.argv.includes('--no-shots')) {
    await screenshots(R);
    await require('./compare-sheets')(SCREENS);
  }
  await close();
  for (const p of PAGES) console.log(p.file.padEnd(16), fs.statSync(path.join(SITE, p.file)).size, 'bytes');
  for (const f of fs.readdirSync(path.join(SITE, 'downloads'))) console.log('downloads/' + f, sizes[f]);
})();
