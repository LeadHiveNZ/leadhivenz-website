// Side-by-side comparison sheets documented in critique.md (round 2 decisions).
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const M = require('../concepts/marks');
const { bounds } = require('../lib/geo');
const { svgToPng, htmlToPng } = require('../lib/render');

const palH = { navy: '#0C1C45', ocean: '#2A7FD4', sun: '#F4B23E' }, palHN = { ...palH, navy: '#FFFFFF' };
const palM = { navy: '#0A2272', ocean: '#1B8BE6', sun: '#FFC629' }, palMN = { ...palM, navy: '#FFFFFF' };
const svg = (parts, p, padK = 0.06) => { const b = bounds(parts.map(x => x.item)); const s = Math.max(b.width, b.height) * (1 + 2 * padK);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.center.x - s / 2} ${b.center.y - s / 2} ${s} ${s}">${parts.map(q => `<path fill="${p[q.role]}" d="${q.item.pathData}"/>`).join('')}</svg>`; };

module.exports = async function compareSheets(outDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onshore-cmp-'));
  const px = async (s, name, size) => {
    const f = path.join(tmp, `${name}-${size}.png`), z = path.join(tmp, `${name}-${size}-zoom.png`);
    await svgToPng(s, f, { width: size, height: size });
    execSync(`convert "${f}" -background white -alpha remove -filter point -resize ${Math.round(96 / size * 100)}% "${z}"`);
    return 'data:image/png;base64,' + fs.readFileSync(z).toString('base64');
  };
  const sheet = async (title, rows, out) => {
    let html = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:13px Inter,sans-serif;background:#fff"><div style="padding:18px 22px"><div style="font-weight:700;font-size:16px;margin-bottom:12px;color:#0B1F5C">${title}</div><div style="display:grid;grid-template-columns:repeat(${rows.length},1fr);gap:16px">`;
    for (const r of rows) {
      const z32 = await px(r.small, r.key, 32), z16 = await px(r.small, r.key, 16);
      html += `<div style="border:1px solid #e3e6ec;border-radius:12px;padding:14px"><div style="font-weight:600;margin-bottom:8px">${r.label}</div>
        <div style="display:flex;gap:10px;align-items:center">${r.big.replace('<svg', '<svg width="170" height="170"')}<div style="background:${r.bg};padding:8px;border-radius:8px">${r.bigN.replace('<svg', '<svg width="110" height="110"')}</div></div>
        <div style="display:flex;gap:14px;align-items:flex-end;margin-top:12px">${r.small.replace('<svg', '<svg width="32" height="32"')}${r.small.replace('<svg', '<svg width="16" height="16"')}
        <img src="${z32}" width="96" height="96" style="image-rendering:pixelated;border:1px solid #e3e6ec"><img src="${z16}" width="96" height="96" style="image-rendering:pixelated;border:1px solid #e3e6ec"></div>
        <div style="color:#5b6475;font-size:12px;margin-top:8px">${r.note}</div></div>`;
    }
    const f = path.join(tmp, out.replace('.png', '.html')); fs.writeFileSync(f, html + '</div></div></body>');
    const raw = path.join(tmp, out); await htmlToPng(f, raw, { width: 1200, dsf: 2 });
    execSync(`convert "${raw}" -trim +repage -bordercolor white -border 36 "${path.join(outDir, out)}"`);
  };
  const hook = { split: true, rightCap: 'square', th: 15, wrap: 128 }, hookS = { split: true, rightCap: 'square', th: 26, gap: 11, wg: 11, xl: -100, wrap: 132, A: 3 };
  await sheet('Concept 2, Horizon: round-1 hook vs round-2 options (32 / 16 px zooms use each favicon cut)', [
    { key: 'h-hook', label: 'Round 1: square end ("hook")', big: svg(M.horizon(hook), palH), bigN: svg(M.horizon(hook), palHN), bg: '#0C1C45', small: svg(M.horizon(hookS), palH), note: 'Read as a fishing hook or letter J; the squared end looks unfinished.' },
    { key: 'h-taper', label: 'Kept: tapered breeze, 108° wrap', big: svg(M.horizon({ split: true }), palH), bigN: svg(M.horizon({ split: true }), palHN), bg: '#0C1C45',
      small: svg(M.horizon({ split: true, th: 26, gap: 11, wg: 11, xl: -100, wrap: 100, hold: 24, pow: 0.55, A: 3 }), palH), note: 'Flat horizon, constant gap under and around the sun, tapers to a point: reads as moving air.' },
    { key: 'h-round', label: 'Tried: round cap, 100° wrap', big: svg(M.horizon({ split: true, rightCap: 'round', wrap: 100 }), palH), bigN: svg(M.horizon({ split: true, rightCap: 'round', wrap: 100 }), palHN), bg: '#0C1C45',
      small: svg(M.horizon({ split: true, rightCap: 'round', wrap: 95, th: 26, gap: 11, wg: 11, xl: -100, A: 3 }), palH), note: 'Cleaner than the square end, but the constant width plus cap still reads as a J.' },
  ], 'horizon-taper-vs-roundcap.png');
  const flat = { split: 'flat', r: 62, gap: 7, y0: 12, A: 5, wl: 60, wg: 7.5 }, diag = { r: 67, gap: 7, wg: 7.5, alpha: 30, A: 6.5 };
  await sheet('Concept 3, Monogram: flat wave (round 1) vs diagonal split (round 2)', [
    { key: 'm-flat', label: 'Round 1: flat wave, ring 38', big: svg(M.monogram(flat), palM), bigN: svg(M.monogram(flat), palMN), bg: '#0A2272', small: svg(M.monogram({ split: 'flat', r: 60, gap: 11, y0: 10, A: 4, wl: 70, wg: 11 }), palM), note: 'Clear at 16 px: big yellow top over blue.' },
    { key: 'm-diag', label: 'Kept: diagonal S-split, ring 33 (-13%)', big: svg(M.monogram(diag), palM), bigN: svg(M.monogram(diag), palMN), bg: '#0A2272', small: svg(M.monogram({ r: 66, gap: 10, wg: 10, A: 5 }), palM), note: 'Equally clear at 16 px, larger inner mark at 32 px, and it carries the heritage diagonal.' },
  ], 'monogram-flat-vs-diagonal.png');
  fs.rmSync(tmp, { recursive: true, force: true });
};
