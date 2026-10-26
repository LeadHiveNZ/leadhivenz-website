// Scores font candidates against the original wordmark: fits size and tracking (and, for "tube" mode, the stroke that
// turns a thin skeleton into the original's yellow tube) and measures mask overlap (IoU) for the word and letter by letter.
// usage: bash fetch-candidates.sh && node score.js [candidates.json] [out-dir]   (needs Playwright)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const DIR = __dirname;
const cands = JSON.parse(fs.readFileSync(process.argv[2] || path.join(DIR, 'candidates.json'), 'utf8'));
const OUT = process.argv[3] || path.join(DIR, 'rows'); fs.mkdirSync(OUT, { recursive: true });
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'orig_meta.json'), 'utf8'));
const maskB64 = fs.readFileSync(path.join(DIR, 'orig_mask.png')).toString('base64');
const origB64 = fs.readFileSync(path.join(DIR, '..', '..', 'source', 'onshore-logo-original.png')).toString('base64');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.setContent('<html><body></body></html>');
  const results = [];
  for (const c of cands) {
    const fontB64 = fs.readFileSync(path.join(DIR, 'ttf', c.file)).toString('base64');
    const r = await page.evaluate(async ({ c, fontB64, maskB64, origB64, meta }) => {
      const bin = Uint8Array.from(atob(fontB64), (ch) => ch.charCodeAt(0));
      const ff = new FontFace('F' + c.file.replace(/\W/g, ''), bin.buffer);
      await ff.load(); document.fonts.add(ff);
      const fam = ff.family;
      const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const maskImg = await loadImg('data:image/png;base64,' + maskB64);
      const origImg = await loadImg('data:image/png;base64,' + origB64);
      const W = meta.w, H = meta.h, pad = meta.pad;
      const mk = (w = W, h = H) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
      const target = (() => { const cv = mk(); const x = cv.getContext('2d'); x.drawImage(maskImg, 0, 0); const d = x.getImageData(0, 0, W, H).data; const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = d[i * 4] > 127 ? 1 : 0; return m; })();
      const capT = H - 2 * pad; // 78
      // ink bbox of a canvas
      const bbox = (cv) => { const x = cv.getContext('2d'); const d = x.getImageData(0, 0, cv.width, cv.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < cv.height; y++) for (let xx = 0; xx < cv.width; xx++) if (d[(y * cv.width + xx) * 4 + 3] > 100) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
      const draw = (ctx, text, size, ls, sw, join, x, y) => {
        ctx.font = `${size}px ${fam}`; ctx.letterSpacing = ls + 'px'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
        if (sw > 0) { ctx.lineWidth = sw; ctx.lineJoin = join; ctx.miterLimit = 2.5; ctx.lineCap = 'square'; ctx.strokeText(text, x, y); }
        ctx.fillText(text, x, y);
      };
      const render = (text, size, ls, sw, join, w = 1400, h = 400) => { const cv = mk(w, h); draw(cv.getContext('2d'), text, size, ls, sw, join, 60, 300); return cv; };
      // 1) glyph stem thickness and cap height per unit size (thin glyph, no stroke)
      const H100 = bbox(render('H', 100, 0, 0, 'miter'));
      const I100 = bbox(render('I', 100, 0, 0, 'miter'));
      const stem100 = I100.w; const cap100 = H100.h;
      let sw = 0, size = capT / cap100 * 100;
      if (c.mode === 'tube') {
        for (let it = 0; it < 6; it++) { const g = stem100 * size / 100; sw = Math.max(4, 25 - g); size = (capT - sw) / cap100 * 100; }
      }
      const joins = c.mode === 'tube' ? ['miter', 'round'] : ['miter'];
      let best = null;
      for (const join of joins) {
        // 2) tracking so the ink width matches the original (535 px)
        const w0 = bbox(render(c.text || 'ONSHORE AIR', size, 0, sw, join, 2200, 400)).w;
        const ls = (meta.w - 2 * pad - w0) / 10;
        // 3) render aligned: ink box at (pad,pad)
        const tmp = render(c.text || 'ONSHORE AIR', size, ls, sw, join, 2200, 400); const bb = bbox(tmp);
        const cand = mk(); const cx = cand.getContext('2d'); cx.drawImage(tmp, bb.x0 - pad, bb.y0 - pad, W, H, 0, 0, W, H);
        const cd = cx.getImageData(0, 0, W, H).data; let inter = 0, uni = 0;
        const cm = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) { const a = cd[i * 4 + 3] > 127 ? 1 : 0; cm[i] = a; inter += a & target[i]; uni += a | target[i]; }
        const iouWord = inter / uni;
        // 4) per-letter IoU: each glyph scaled to cap height, centred on the original letter's box
        const letters = 'ONSHOREAIR'.split('');
        let sumI = 0; const per = [];
        letters.forEach((ch, k) => {
          const [lx0, lx1] = meta.letters[k]; const ox0 = lx0 - meta.x0, ox1 = lx1 - meta.x0;
          const g = render(ch, size, 0, sw, join, 600, 400); const gb = bbox(g);
          const lc = mk(); const lx = lc.getContext('2d');
          const cxo = (ox0 + ox1) / 2 - gb.w / 2;
          lx.drawImage(g, gb.x0, gb.y0, gb.w, gb.h, cxo, pad, gb.w, gb.h);
          const ld = lx.getImageData(0, 0, W, H).data; let i2 = 0, u2 = 0;
          const xa = Math.max(0, Math.floor(Math.min(ox0, cxo)) - 2), xb = Math.min(W, Math.ceil(Math.max(ox1 + 1, cxo + gb.w)) + 2);
          for (let y = 0; y < H; y++) for (let x = xa; x < xb; x++) { const i = y * W + x; const a = ld[i * 4 + 3] > 127 ? 1 : 0; const t = target[i] && x >= ox0 - 1 && x <= ox1 + 1 ? 1 : 0; i2 += a & t; u2 += a | t; }
          per.push(+(i2 / u2).toFixed(3)); sumI += i2 / u2;
        });
        const res = { join, size: +size.toFixed(1), sw: +sw.toFixed(1), ls: +ls.toFixed(2), iouWord: +iouWord.toFixed(4), iouLetters: +(sumI / letters.length).toFixed(4), per, naturalWidth: w0 };
        if (!best || res.iouLetters > best.iouLetters) {
          best = res;
          // overlay row: original (left), candidate as yellow tube with navy inline (middle), overlay (right)
          const S = 2, RW = W * S, row = mk(RW * 3 + 40, H * S + 10); const rx = row.getContext('2d');
          rx.fillStyle = '#0C1D45'; rx.fillRect(0, 0, row.width, row.height);
          rx.imageSmoothingEnabled = true;
          rx.drawImage(origImg, meta.x0, meta.y0, W, H, 0, 5, RW, H * S);
          // candidate rendering at 2x
          const big = mk(4400, 800); const bx = big.getContext('2d');
          bx.save(); bx.scale(S, S);
          bx.font = `${size}px ${fam}`; bx.letterSpacing = ls + 'px';
          if (sw > 0) { bx.lineWidth = sw; bx.lineJoin = join; bx.miterLimit = 2.5; bx.lineCap = 'square'; bx.strokeStyle = '#EEDF62'; bx.strokeText(c.text || 'ONSHORE AIR', 60, 300); bx.fillStyle = '#0C1D45'; bx.fillText(c.text || 'ONSHORE AIR', 60, 300); }
          else { bx.fillStyle = '#EEDF62'; bx.fillText(c.text || 'ONSHORE AIR', 60, 300); }
          bx.restore();
          const bb2 = bbox(big);
          rx.drawImage(big, bb2.x0 - pad * S, bb2.y0 - pad * S, RW, H * S, RW + 20, 5, RW, H * S);
          // overlay: original mask in yellow, candidate mask edge in cyan
          const ov = mk(); const ox = ov.getContext('2d'); const od = ox.createImageData(W, H);
          for (let i = 0; i < W * H; i++) { const t = target[i], a = cm[i]; const o = i * 4; if (t && a) { od.data[o] = 238; od.data[o + 1] = 223; od.data[o + 2] = 98; } else if (t) { od.data[o] = 230; od.data[o + 1] = 60; od.data[o + 2] = 60; } else if (a) { od.data[o] = 60; od.data[o + 1] = 200; od.data[o + 2] = 240; } else { od.data[o] = 12; od.data[o + 1] = 29; od.data[o + 2] = 69; } od.data[o + 3] = 255; }
          ox.putImageData(od, 0, 0); rx.imageSmoothingEnabled = false; rx.drawImage(ov, 0, 0, W, H, (RW + 20) * 2, 5, RW, H * S);
          res.png = row.toDataURL('image/png');
          best = res;
        }
      }
      return best;
    }, { c, fontB64, maskB64, origB64, meta });
    const png = r.png; delete r.png;
    const file = path.join(OUT, c.name.replace(/\W+/g, '-') + '.png');
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    results.push({ name: c.name, mode: c.mode, ...r, file });
    console.log(`${c.name.padEnd(34)} ${c.mode.padEnd(5)} letters ${r.iouLetters.toFixed(3)}  word ${r.iouWord.toFixed(3)}  size ${r.size} sw ${r.sw} ls ${r.ls} ${r.join}  per ${r.per.join(' ')}`);
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  await b.close();
})();
