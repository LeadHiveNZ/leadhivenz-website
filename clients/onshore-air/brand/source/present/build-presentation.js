// Build presentation.html (self-contained) and screenshots. Usage: node present/build-presentation.js
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const { build, CONCEPTS, OUT } = require('../build');
const { inline, b64, svgData } = require('./parts');
const MK = require('./mockups');
const { htmlToPng, close, getBrowser } = require('../lib/render');
const ROOT = path.join(__dirname, '..');
// PRESENT_OUT: where presentation.html/.png and screens/ go (default: next to build.js)
const POUT = process.env.PRESENT_OUT ? path.resolve(process.env.PRESENT_OUT) : ROOT;
// OLD_LOGO: the client's current logo, shown in the before/after section
const OLD_LOGO = process.env.OLD_LOGO ? path.resolve(process.env.OLD_LOGO) : path.join(ROOT, 'reference', 'current-logo.png');

// ---- contrast helpers
const lum = hex => { const c = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = hex => hex.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(' ');

const RATIONALE = {
  evolution: [
    'This is the sun-meets-sea sphere Onshore Air already owns, rebuilt as four flat bands so it prints, embroiders and still reads as a favicon.',
    'The diagonal S-split tells the product story at a glance: Sunshine Coast heat in the bottom-left, cool ocean air in the top-right.',
    'Paired with a heavy, round-shouldered Outfit wordmark, it looks like the same company, grown up.'],
  horizon: [
    'The sun sits on a single line that is both the coastline horizon and the onshore breeze. It runs flat under the sun, then sweeps up the right side and tapers away like a gust of sea air.',
    'Inside the sun, the warm/cool split is kept as sun over sea, and the whole mark uses only two main colours plus an ocean-blue accent.',
    'Set in a wide-tracked Sora wordmark, it has the calm restraint of an OEM dealer badge and is the most premium of the three in large formats.'],
  monogram: [
    'A navy O, the initial of Onshore, frames the original diagonal sun-meets-sea split: warm bottom-left, cool top-right.',
    'It is the simplest, sturdiest silhouette of the three, so it holds up at 16 px, on a cap and as a Google avatar.',
    'The Red Hat Display Black wordmark adds corporate weight. The trade-off is that the ring makes it read more like a badge than a personality.'],
};
const FONTNOTE = {
  evolution: 'Outfit ExtraBold (wordmark) · Outfit SemiBold (descriptor) · Google Fonts, SIL Open Font Licence',
  horizon: 'Sora Bold (wordmark) · Sora SemiBold (descriptor) · Google Fonts, SIL Open Font Licence',
  monogram: 'Red Hat Display Black (wordmark) · Red Hat Display Bold (descriptor) · Google Fonts, SIL Open Font Licence',
};

(async () => {
  const R = CONCEPTS.map(cfg => build(cfg));
  // old logo, downsized for embedding
  const oldSmall = path.join(require('os').tmpdir(), 'onshore-old-logo-small.png');
  execSync(`convert "${OLD_LOGO}" -resize 420x "${oldSmall}"`);
  const OLD = b64(oldSmall);
  const px16 = r => b64(path.join(OUT, r.cfg.id, 'png', 'icon-16.png'));
  const px16m = r => b64(path.join(OUT, r.cfg.id, 'png', 'icon-master-16.png'));

  const swatches = r => r.cfg.colours.map(c => {
    const onW = cr(c.hex, '#FFFFFF'), onN = cr(c.hex, r.P.navy);
    let note;
    if (c.role === 'navy') note = `White text on it ${cr('#FFFFFF', c.hex).toFixed(1)}:1 (AAA). Type and backgrounds`;
    else if (onW >= 4.5) note = `Text-safe on white ${onW.toFixed(1)}:1`;
    else if (onW >= 3) note = `Large type on white ${onW.toFixed(1)}:1 · on navy ${onN.toFixed(1)}:1`;
    else note = `On navy ${onN.toFixed(1)}:1 · accent only on white`;
    const dark = lum(c.hex) < 0.25;
    return `<div class="sw" style="background:${c.hex};color:${dark ? '#fff' : '#0B1F5C'}"><b>${c.name}</b><span>${c.hex}</span><span>RGB ${rgb(c.hex)}</span><em>${note}</em></div>`;
  }).join('') + `<div class="sw" style="background:#fff;color:#0B1F5C;border:1px solid #dde1e8"><b>White</b><span>#FFFFFF</span><span>RGB 255 255 255</span><em>Clear space and reversed artwork</em></div>`;

  const conceptSection = (r, i) => {
    const f = r.files, s = r.cfg.slug;
    return `<section class="concept" id="concept-${i + 1}" style="--cnavy:${r.P.navy}">
    <div class="chead"><div class="cnum">0${i + 1}</div><div><div class="eyebrow">Concept ${i + 1}</div><h2>${r.cfg.title}</h2></div></div>
    <div class="crat">${RATIONALE[s].map(x => `<p>${x}</p>`).join('')}</div>
    <div class="palette">${swatches(r)}</div>
    <p class="fontnote"><b>Type</b> ${FONTNOTE[s]}. All lettering is converted to outlines, so the files never depend on installed fonts.</p>
    <div class="grid2">
      <div class="tile w big">${inline(f['primary-stacked.svg'], { cls: 'lg-stacked' })}<label>primary-stacked.svg</label></div>
      <div class="tile n big">${inline(f['primary-stacked-on-navy.svg'], { cls: 'lg-stacked' })}<label>primary-stacked-on-navy.svg</label></div>
      <div class="tile w wide">${inline(f['horizontal.svg'], { cls: 'lg-horiz' })}<label>horizontal.svg</label></div>
      <div class="tile n wide">${inline(f['horizontal-on-navy.svg'], { cls: 'lg-horiz' })}<label>horizontal-on-navy.svg</label></div>
    </div>
    <div class="grid4">
      <div class="tile w">${inline(f['icon.svg'], { cls: 'lg-icon' })}<label>icon.svg</label></div>
      <div class="tile n">${inline(f['icon-on-navy.svg'], { cls: 'lg-icon' })}<label>icon-on-navy.svg</label></div>
      <div class="tile w">${inline(f['mono-navy.svg'], { cls: 'lg-mono' })}<label>mono-navy.svg · embroidery cut</label></div>
      <div class="tile n">${inline(f['mono-white.svg'], { cls: 'lg-mono' })}<label>mono-white.svg · embroidery cut</label></div>
      <div class="tile w">${inline(f['wordmark.svg'], { cls: 'lg-word' })}<label>wordmark.svg</label></div>
      <div class="tile w">${inline(f['horizontal-compact.svg'], { cls: 'lg-compact' })}<label>horizontal-compact.svg</label></div>
      <div class="tile n">${inline(f['horizontal-compact-on-navy.svg'], { cls: 'lg-compact' })}<label>horizontal-compact-on-navy.svg</label></div>
      <div class="tile g">${inline(f['icon-app.svg'], { cls: 'lg-app' })}<label>icon-app.svg · avatar / app tile</label></div>
    </div>
    <div class="small">
      <div class="eyebrow">Small-size tests</div>
      <div class="srow">
        <div class="sblock"><div class="sizes">${[16, 24, 32, 48].map(z => `<img src="${svgData(f['favicon.svg'])}" width="${z}" height="${z}" alt="favicon ${z}px">`).join('')}</div><label>favicon.svg at 16 / 24 / 32 / 48 px</label></div>
        <div class="sblock dark"><div class="sizes">${[16, 24, 32, 48].map(z => `<img src="${svgData(f['_favicon-dark-preview'])}" width="${z}" height="${z}" alt="favicon ${z}px on dark">`).join('')}</div><label>on a dark browser bar: navy switches to white automatically</label></div>
        <div class="sblock"><div class="zoom"><img src="${px16m(r)}" width="96" height="96" alt="master icon at 16px, zoomed"><img src="${px16(r)}" width="96" height="96" alt="favicon cut at 16px, zoomed"></div><label>16 px pixels, zoomed 6×: master icon (left) and favicon cut (right)</label></div>
        <div class="sblock"><div class="at120">${inline(f['horizontal.svg'], { w: 120 })}${inline(f['horizontal-compact.svg'], { w: 120 })}</div><label>horizontal and compact lockups at 120 px wide</label></div>
      </div>
    </div>
  </section>`;
  };

  // clear space: x = name cap height = 100 design units; lockup files carry 0.5x padding
  const clearSpace = r => {
    const svg = r.files['horizontal.svg'];
    const [, , W, H] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const X = 100, p = 50; // x, file padding
    const ax = p, ay = p, aw = W - 2 * p, ah = H - 2 * p;            // artwork box
    const cx = ax - X, cy = ay - X, cw = aw + 2 * X, ch = ah + 2 * X; // clear-space box
    const m = 40, vb = [cx - m, cy - m, cw + 2 * m, ch + 2 * m];
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[^>]*>[^<]*<\/title>/, '').replace(/\sid="[^"]*"/g, '');
    const sq = (x, y) => `<rect x="${x}" y="${y}" width="${X}" height="${X}" fill="#fde7ee" stroke="#e0567a" stroke-width="3"/><text x="${x + X / 2}" y="${y + X / 2 + 16}" text-anchor="middle" font-size="46" font-family="Inter,Arial,sans-serif" fill="#e0567a" font-weight="600">x</text>`;
    return `<svg viewBox="${vb.join(' ')}" class="cs" role="img" aria-label="Clear space around the ${r.cfg.title} horizontal lockup">
      <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#eef3fb"/>
      <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="#8d9bb8" stroke-width="3" stroke-dasharray="14 10"/>
      <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#c9d2e3" stroke-width="2"/>
      ${inner}
      ${sq(cx, cy)}${sq(ax + aw, cy)}${sq(cx, ay + ah)}${sq(ax + aw, ay + ah)}
    </svg>`;
  };

  const mockSection = (id, title, intro, inner, cls = '') => `<section class="mock ${cls}" id="${id}"><div class="eyebrow">In use</div><h2>${title}</h2><p class="intro">${intro}</p>${inner}</section>`;

  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Onshore Air Logo Refresh</title>
<meta name="description" content="Three logo concepts for Onshore Air, air conditioning on the Sunshine Coast, with mockups and a recommendation.">
<link rel="icon" href="${svgData(R[0].files['favicon.svg'])}">
<style>
:root{--navy:#0B1F5C;--ink:#121a2e;--muted:#5b6475;--line:#e3e6ec;--bg:#f5f6f8;--paper:#fff}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px}
section{background:var(--paper);border-radius:20px;padding:56px;margin:28px 0;box-shadow:0 1px 2px rgba(16,24,40,.04)}
h1{font-size:54px;line-height:1.05;letter-spacing:-.02em;margin:0 0 18px;font-weight:700}
h2{font-size:34px;line-height:1.1;letter-spacing:-.015em;margin:4px 0 18px;color:var(--navy);font-weight:700}
h3{font-size:18px;margin:0 0 8px;color:var(--navy)}
p{margin:0 0 12px;max-width:72ch}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#7a8396}
.cover{background:var(--navy);color:#fff;padding:72px 56px 56px;position:relative;overflow:hidden}
.cover .eyebrow{color:#9fb3e3}
.cover p{color:#d6def2;font-size:19px;max-width:60ch}
.cover .icons{display:flex;gap:28px;margin-top:40px;align-items:center}
.cover .icons svg{height:84px;width:auto}
.meta{display:flex;gap:28px;flex-wrap:wrap;margin-top:36px;font-size:13px;color:#9fb3e3}
.meta b{color:#fff;font-weight:600}
.strategy ol{margin:8px 0 0;padding-left:22px}
.strategy li{margin:6px 0;max-width:80ch}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:32px}
.keepfix{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}
.keepfix div{background:var(--bg);border-radius:14px;padding:20px 24px}
.keepfix ul{margin:6px 0 0;padding-left:18px}
.before{display:grid;grid-template-columns:1.05fr 1fr 1fr 1fr;gap:16px;margin-top:20px}
.bcell{border-radius:14px;min-height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;position:relative}
.bcell img{max-width:100%;height:auto;display:block}
.bcell svg{width:86%;height:auto}
.bcell label,.tile label{position:absolute;left:14px;bottom:10px;font-size:11px;letter-spacing:.04em;color:#8a93a5}
.bcell.old{background:#000}
.badge{position:absolute;top:12px;left:12px;background:#FFC233;color:#0B1F5C;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:4px 10px}
.bcell.nv,.tile.n{background:var(--cnavy,var(--navy))}
.tile.n label,.bcell.nv label,.bcell.old label{color:#8ea0cf}
.chead{display:flex;gap:22px;align-items:center}
.cnum{font-size:56px;font-weight:700;color:#d8deea;line-height:1;letter-spacing:-.03em}
.crat{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:8px 0 26px}
.crat p{font-size:15.5px;color:#3b4457;margin:0}
.palette{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px}
.sw{border-radius:12px;padding:16px 16px 14px;min-height:118px;display:flex;flex-direction:column;gap:2px;font-size:12.5px}
.sw b{font-size:14px;margin-bottom:4px}
.sw em{font-style:normal;opacity:.85;margin-top:auto;font-size:11.5px}
.fontnote{font-size:13.5px;color:var(--muted);margin:12px 0 22px;max-width:none}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:14px}
.tile{border-radius:14px;display:flex;align-items:center;justify-content:center;position:relative;padding:30px 24px 36px;min-height:190px}
.tile.w{background:#fff;border:1px solid var(--line)}
.tile.g{background:var(--bg)}
.tile.big{min-height:330px}
.tile.wide{min-height:190px}
.lg-stacked{width:72%;height:auto}
.lg-horiz{width:88%;height:auto}
.lg-icon{width:42%;height:auto}
.lg-mono{width:80%;height:auto}
.lg-word{width:86%;height:auto}
.lg-compact{width:88%;height:auto}
.lg-app{width:46%;height:auto;border-radius:22%}
.small{margin-top:26px;border-top:1px solid var(--line);padding-top:22px}
.srow{display:grid;grid-template-columns:1fr 1fr 1.25fr 1.25fr;gap:14px;margin-top:12px}
.sblock{border:1px solid var(--line);border-radius:14px;padding:18px 16px 40px;position:relative;min-height:150px;display:flex;align-items:center;justify-content:center}
.sblock.dark{background:#202124;border-color:#202124}
.sblock label{position:absolute;left:14px;right:14px;bottom:10px;font-size:11px;color:#8a93a5;line-height:1.35}
.sizes{display:flex;gap:16px;align-items:flex-end}
.zoom{display:flex;gap:18px}
.zoom img{image-rendering:pixelated;border:1px solid var(--line)}
.at120{display:flex;flex-direction:column;gap:16px;align-items:center}
.mock .intro{color:var(--muted)}
.vans{display:grid;gap:22px;margin-top:18px}
.vrow{background:linear-gradient(#eef2f6,#e6ebf1);border-radius:16px;padding:18px 26px 8px;position:relative}
.vrow label,.prow label{position:absolute;left:18px;top:12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7d879a;font-weight:600}
.mock-van{width:100%;height:auto;display:block}
.polos{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px}
.prow{background:#eceff3;border-radius:16px;padding:34px 18px 18px;position:relative}
.mock-polo{width:100%;height:auto;display:block}
.gbps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px}
.gbp{background:#fff;border-radius:16px;box-shadow:0 2px 6px rgba(60,64,67,.15),0 1px 2px rgba(60,64,67,.3);overflow:hidden;position:relative;font-family:Roboto,Inter,Arial,sans-serif}
.gcover{height:118px;background:linear-gradient(180deg,#8cc8f0 0%,#bfe2f7 58%,#2f86c9 58%,#1d6fb0 100%);position:relative}
.gsun{position:absolute;width:54px;height:54px;border-radius:50%;right:46px;top:30px;opacity:.95}
.gav{position:absolute;left:18px;top:76px;width:84px;height:84px;border-radius:50%;background:#fff;padding:3px;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.gavimg{width:100%;height:100%;border-radius:50%;display:block}
.gbody{padding:52px 18px 18px}
.gname{font-size:22px;color:#202124}
.grate{display:flex;align-items:center;gap:2px;font-size:14px;color:#70757a;margin-top:2px}
.grate b{color:#202124;font-weight:500;margin-right:4px}
.grate span{margin-left:4px}
.gcat{font-size:14px;color:#70757a}
.gopen{font-size:14px;color:#70757a;margin-top:2px}
.gopen b{color:#188038;font-weight:500}
.gbtns{display:flex;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid #e8eaed}
.gbtn{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:#1a73e8}
.gic{width:38px;height:38px;border-radius:50%;border:1px solid #dadce0;display:flex;align-items:center;justify-content:center}
.gmaps{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:12px;color:#70757a;background:#f1f3f4;border-radius:10px;padding:8px 10px}
.gpin{width:32px;height:32px;border-radius:50%;overflow:hidden;flex:none;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.gpinimg{width:32px;height:32px;display:block}
.phones{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px;justify-items:center}
.phone{width:300px;height:600px;border-radius:46px;background:#111;padding:11px;box-shadow:0 18px 40px rgba(16,24,40,.25)}
.pscreen{width:100%;height:100%;border-radius:36px;overflow:hidden;background:#f3f5f8;position:relative}
.pstatus{height:40px;color:#fff;font-size:12px;font-weight:600;display:flex;justify-content:space-between;align-items:flex-end;padding:0 24px 6px}
.pdots{letter-spacing:1px;font-size:9px}
.phead{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.plogo{height:30px;width:auto}
.pburger{display:flex;flex-direction:column;gap:5px}
.pburger i{display:block;width:22px;height:2.5px;background:#fff;border-radius:2px}
.phero{padding:26px 20px 26px;color:#c9d4ee}
.phero svg{margin-bottom:8px}
.phero p{font-size:13px;line-height:1.5;margin:10px 0 16px}
.pcta{border-radius:999px;text-align:center;font-weight:700;font-size:14px;padding:12px 10px}
.ptrust{font-size:11px;margin-top:12px;color:#9fb0d8;text-align:center}
.pcards{padding:16px 18px;display:grid;gap:12px}
.pcards div{height:92px;background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06);padding:16px 16px;display:flex;flex-direction:column;gap:8px}
.pcards b{font-size:13px;color:#0B1F5C}
.pcards i{display:block;height:7px;border-radius:4px;background:#e7eaf0;width:88%}
.pcards i.s{width:56%}
.cardsgrid{display:grid;gap:26px;margin-top:20px}
.cards{display:flex;gap:26px;justify-content:center}
.bcard{width:336px;height:204px;border-radius:10px;box-shadow:0 10px 24px rgba(16,24,40,.16),0 2px 4px rgba(16,24,40,.08);position:relative;display:flex;align-items:center;justify-content:center;background:#fff}
.bclogo{width:62%;height:auto}
.bcard.back{justify-content:flex-start;padding:0 26px}
.bcl{display:flex;flex-direction:column;align-items:flex-start}
.bcicon{position:absolute;right:22px;top:22px;width:52px;height:52px}
.crow{display:grid;grid-template-columns:140px 1fr;align-items:center;gap:10px}
.crow .eyebrow{text-align:right;padding-right:10px}
.browser{border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(16,24,40,.14);margin-top:18px;background:#fff;font-family:Inter,Arial,sans-serif}
.tabbar{background:#dee1e6;display:flex;align-items:flex-end;gap:2px;padding:10px 10px 0;height:46px}
.dots{display:flex;gap:7px;padding:0 14px 12px 4px}
.dots i{width:12px;height:12px;border-radius:50%;background:#ff5f57;display:block}
.dots i:nth-child(2){background:#febc2e}.dots i:nth-child(3){background:#28c840}
.tab{display:flex;align-items:center;gap:9px;height:36px;padding:0 14px;border-radius:10px 10px 0 0;font-size:12.5px;color:#3c4043;min-width:210px}
.tab img{flex:none}
.tab b{margin-left:auto;font-weight:400;color:#5f6368}
.tab.on{background:#fff}
.tab.ghost{opacity:.6}
.toolbar{display:flex;align-items:center;gap:14px;padding:9px 14px;background:#fff;border-bottom:1px solid #e8eaed}
.toolbar .nav{color:#5f6368;letter-spacing:6px}
.url{flex:1;background:#f1f3f4;border-radius:999px;padding:7px 16px;font-size:13px;color:#202124}
.lock{color:#5f6368;margin-right:6px;vertical-align:-1px}
.browser.dark{background:#35363a}
.browser.dark .tabbar{background:#202124}
.browser.dark .tab{color:#e8eaed}
.browser.dark .tab.on{background:#35363a}
.browser.dark .tab b{color:#9aa0a6}
.browser.dark .toolbar{background:#35363a;border-color:#2a2b2e}
.browser.dark .url{background:#202124;color:#e8eaed}
.reco{background:var(--navy);color:#e6ecf8}
.reco h2{color:#fff}
.reco .eyebrow{color:#9fb3e3}
.reco .win{display:grid;grid-template-columns:360px 1fr;gap:40px;align-items:center;margin-top:12px}
.reco .win .lg{background:#fff;border-radius:18px;padding:34px;display:flex;align-items:center;justify-content:center}
.reco .win .lg svg{width:100%;height:auto}
.reco ol{padding-left:20px;margin:10px 0}
.reco li{margin:8px 0;max-width:70ch}
.reco .alt{margin-top:26px;padding-top:20px;border-top:1px solid rgba(255,255,255,.15);color:#c3cfeb;font-size:15px}
.next ol{padding-left:20px}
.next li{margin:6px 0}
.csgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0 26px}
.csbox{border:1px solid var(--line);border-radius:14px;padding:18px 18px 34px;position:relative;background:#fff}
.csbox label{position:absolute;left:14px;bottom:10px;font-size:11px;color:#8a93a5}
.cs{width:100%;height:auto;display:block}
.mins{width:100%;border-collapse:collapse;font-size:14px}
.mins th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7a8396;font-weight:600;border-bottom:1px solid var(--line);padding:10px 12px}
.mins td{border-bottom:1px solid var(--line);padding:11px 12px;vertical-align:top}
.mins td:first-child{font-weight:600;color:var(--navy);white-space:nowrap}
footer{color:#8a93a5;font-size:12.5px;text-align:center;padding:10px 0 50px}
@media (max-width:900px){
  .wrap{padding:0 16px} section{padding:28px 20px} h1{font-size:36px} h2{font-size:26px}
  .before,.grid4,.srow,.palette{grid-template-columns:1fr 1fr} .csgrid{grid-template-columns:1fr} .mins{font-size:12.5px} .mins td:first-child{white-space:normal} .grid2,.crat,.cols2,.keepfix,.polos,.gbps,.phones,.reco .win{grid-template-columns:1fr}
  .cards{flex-direction:column;align-items:center} .crow{grid-template-columns:1fr} .crow .eyebrow{text-align:left}
  .tab{min-width:0;flex:1} .tab.ghost{display:none}
}
</style></head>
<body><div class="wrap">

<section class="cover">
  <div class="eyebrow">Logo refresh · Round 1 concepts</div>
  <h1>Onshore Air</h1>
  <p>Three logo concepts for the Sunshine Coast's air-conditioning specialists. Each keeps the sun-meets-sea idea Luke already owns, rebuilt as a modern brand system that holds up on a 6 m van and at 16 px in a browser tab.</p>
  <div class="icons">${R.map(r => inline(r.files['icon-on-navy.svg'])).join('')}</div>
  <div class="meta"><span><b>Client</b> Onshore Air, Pacific Paradise QLD</span><span><b>Prepared by</b> LeadHive AU</span><span><b>Date</b> 26 October 2026</span></div>
</section>

<section class="strategy" id="strategy">
  <div class="eyebrow">Strategy</div>
  <h2>Hot outside, cool inside. Told once, simply.</h2>
  <div class="cols2">
    <div>
      <p>Blue owns Australian air conditioning: 13 of the 15 brands we audited lead with blue. Red is the OEM accent, and local installers default to snowflakes, swooshes and stock Montserrat. Nobody owns the coastal warm-to-cool story, and Onshore Air's sun-meets-sea sphere already tells it.</p>
      <p>The job is to keep that idea and make it professional: flat geometry, a confident wordmark and a complete file set.</p>
    </div>
    <ol>
      <li>Keep the circular sun/sea symbol and its warm/cool split. It is Onshore's equity, and it literally describes the product.</li>
      <li>Rebuild it as flat geometry: 3–5 solid shapes, no gradients, no hairlines, embroidery-safe gaps.</li>
      <li>Lead with deep navy. Make sun-gold the signature and ocean blue the cool counterpoint. No red, no lemon yellow.</li>
      <li>Replace the outlined surf-shop type with a heavy, kerned geometric sans, delivered as outlines.</li>
      <li>Ship a full system (stacked, horizontal, compact, icon, favicon, mono, reversed) built to sit beside Daikin, Mitsubishi Electric and Airstage badges.</li>
    </ol>
  </div>
  <div class="keepfix">
    <div><h3>What we keep</h3><ul><li>The circle: sun, sea and air in one shape</li><li>The warm-versus-cool split</li><li>Navy, yellow/gold and ocean blue</li></ul></div>
    <div><h3>What we fix</h3><ul><li>Outlined, low-legibility lettering</li><li>Gradient stripes that cannot embroider or print in one colour</li><li>No small-size, horizontal, mono or reversed versions, and no clear-space rules</li></ul></div>
  </div>
</section>

<section id="before-after">
  <div class="eyebrow">Before and after</div>
  <h2>Same idea, three ways forward</h2>
  <p>The current logo (left), as supplied, beside the three concepts, each on its own navy as it would appear in the website header. Concept 1 keeps today's diagonal sun-meets-sea split most directly, which is why it is our recommendation.</p>
  <div class="before">
    <div class="bcell old"><img src="${OLD}" alt="Current Onshore Air logo"><label>Current logo</label></div>
    ${R.map((r, i) => `<div class="bcell nv" style="--cnavy:${r.P.navy}">${i === 0 ? '<span class="badge">Recommended</span>' : ''}${inline(r.files['primary-stacked-on-navy.svg'])}<label>${i + 1} · ${r.cfg.title}</label></div>`).join('')}
  </div>
</section>

${R.map(conceptSection).join('\n')}

<section id="rules">
  <div class="eyebrow">System rules</div>
  <h2>Clear space and minimum sizes</h2>
  <p>Clear space on every side is <b>x</b>, the cap height of ONSHORE in the wordmark. Nothing else (text, photos, the edge of a van panel) goes inside the dashed line. The supplied files already include a half-x margin.</p>
  <div class="csgrid">${R.map((r, i) => `<div class="csbox">${clearSpace(r)}<label>${i + 1} · ${r.cfg.title}</label></div>`).join('')}</div>
  <table class="mins">
    <thead><tr><th>Artwork</th><th>Smallest on screen</th><th>Smallest in print</th><th>Use it for</th></tr></thead>
    <tbody>
      <tr><td>horizontal.svg (with descriptor)</td><td>240 px wide</td><td>60 mm wide</td><td>Van side, signage, invoices, email signature, website header on desktop</td></tr>
      <tr><td>horizontal-compact.svg</td><td>120 px wide</td><td>30 mm wide</td><td>Mobile website header, social banners, small print</td></tr>
      <tr><td>primary-stacked.svg</td><td>120 px wide</td><td>25 mm wide</td><td>Business cards, square social posts, shirts and signage where space is square</td></tr>
      <tr><td>mono-navy / mono-white (embroidery cut)</td><td>n/a</td><td>60 mm wide (polo chest), 50 mm (cap front)</td><td>Embroidery, engraving, one-colour print, van magnets</td></tr>
      <tr><td>icon.svg / icon-app.svg</td><td>64 px</td><td>8 mm</td><td>Google Business Profile, Facebook and Instagram avatars, app tiles</td></tr>
      <tr><td>favicon.svg (favicon cut)</td><td>16–48 px</td><td>n/a</td><td>Browser tab, bookmarks. It switches its navy to white in dark browser themes</td></tr>
    </tbody>
  </table>
</section>

${mockSection('mock-van', 'On the road', 'A white van side panel: horizontal lockup, phone number and website on the cargo panel, licence and icon on the cab door, services in a navy skirt. Every line of type is set in the concept\'s own font.',
  `<div class="vans">${R.map((r, i) => `<div class="vrow"><label>${i + 1} · ${r.cfg.title}</label>${MK.van(r)}</div>`).join('')}</div>`)}

${mockSection('mock-polo', 'On the team', 'A navy polo with the one-colour white logo embroidered small on the left chest, about 70 mm wide. The mono files use widened gaps so the stitching does not fill in.',
  `<div class="polos">${R.map((r, i) => `<div class="prow"><label>${i + 1} · ${r.cfg.title}</label>${MK.polo(r)}</div>`).join('')}</div>`)}

${mockSection('mock-gbp', 'On Google', 'The Google Business Profile avatar is cropped to a circle and often seen at 32 px in Maps. The app icon file is built for exactly this.',
  `<div class="gbps">${R.map(r => MK.gbp(r)).join('')}</div>`)}

${mockSection('mock-phone', 'On the website', 'A mobile header on the site\'s navy, using the compact horizontal lockup at 30 px high.',
  `<div class="phones">${R.map(r => MK.phone(r)).join('')}</div>`)}

${mockSection('mock-card', 'In the hand', 'Business card, front and back, 90 × 55 mm.',
  `<div class="cardsgrid">${R.map((r, i) => `<div class="crow"><div class="eyebrow">${i + 1} · ${r.cfg.title}</div>${MK.card(r)}</div>`).join('')}</div>`)}

${mockSection('mock-tab', 'In the browser', 'Favicons at their real size in light and dark browser chrome, one tab per concept. These use the optically adjusted favicon cut.',
  MK.tabs(R) + MK.tabs(R, true))}

<section class="reco" id="recommendation">
  <div class="eyebrow">Recommendation</div>
  <h2>Go with Concept 1, Evolution</h2>
  <div class="win">
    <div class="lg">${inline(R[0].files['primary-stacked.svg'])}</div>
    <div>
      <ol>
        <li><b>It keeps the identity Onshore already has.</b> Customers already know the diagonal sun-meets-sea split from the van, the shirts and the Google listing. Evolution is the only concept that keeps it as the whole mark, so the refresh reads as an upgrade, not a rebrand.</li>
        <li><b>It has the most personality.</b> Four flat colours carry on a van at distance and stand out in a social feed or a Maps list, where most trades are blue on white.</li>
        <li><b>It passes the practical tests.</b> The favicon cut reads at 16 px and the embroidery cut has widened gaps. Every lockup has one-colour and on-navy versions.</li>
        <li><b>Its trade-offs are manageable.</b> It is the most colourful of the three, so one-colour jobs use the mono files, and at the very smallest sizes the bands read by colour rather than by shape.</li>
      </ol>
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
    <li>Final artwork pack: SVG master files plus print PDFs with CMYK values proofed by the printer, an embroidery file digitised from the mono artwork, and the van wrap scaled from SVG.</li>
  </ol>
</section>

<footer>Prepared by LeadHive AU for Onshore Air · Concepts are original artwork; typefaces are licensed under the SIL Open Font Licence.</footer>
</div></body></html>`;

  fs.mkdirSync(POUT, { recursive: true });
  const outHtml = path.join(POUT, 'presentation.html');
  fs.writeFileSync(outHtml, html);
  console.log('presentation.html', (fs.statSync(outHtml).size / 1024).toFixed(0), 'KB');
  if (process.argv.includes('--shots')) {
    const shots = path.join(POUT, 'screens'); fs.mkdirSync(shots, { recursive: true });
    await htmlToPng(outHtml, path.join(POUT, 'presentation.png'), { width: 1280, dsf: 1 });
    for (const id of ['strategy', 'before-after', 'concept-1', 'concept-2', 'concept-3', 'rules', 'mock-van', 'mock-polo', 'mock-gbp', 'mock-phone', 'mock-card', 'mock-tab', 'recommendation']) {
      await htmlToPng(outHtml, path.join(shots, id + '.png'), { width: 1280, dsf: 2, selector: '#' + id });
    }
    await close();
  }
})();
