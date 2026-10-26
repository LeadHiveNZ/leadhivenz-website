// Stage a copy of presentation/ for hosts that cannot serve .zip files (the claude.ai artifact host).
// Drops the zip packs and rewrites their links; the PDF stays. Usage: node stage-publish.js <out-dir>
const fs = require('fs'), path = require('path');
const src = path.resolve(__dirname, '..', '..', 'presentation');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out', 'publish'));
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: p => !/[\\/]screens([\\/]|$)/.test(p) && !p.endsWith('.zip') });
const rw = (file, pairs) => {
  const p = path.join(out, file); let s = fs.readFileSync(p, 'utf8');
  for (const [re, to] of pairs) { if (!re.test(s)) throw new Error(`${file}: pattern not found ${re}`); s = s.replace(re, to); }
  fs.writeFileSync(p, s);
};
rw('index.html', [
  [/<a class="btn gold" href="downloads\/onshore-air-concept-1-evolution\.zip">[^<]*<small>[^<]*<\/small><\/a>/, '<a class="btn gold" href="concept-1.html#files">See the Evolution files</a>'],
  [/<a class="btn ghost" href="guidelines\.html#downloads">All downloads<\/a>/, '<a class="btn ghost" href="guidelines.html#downloads">Guidelines and files</a>'],
]);
for (const [n, name] of [[1, 'evolution'], [2, 'horizon'], [3, 'monogram']]) {
  rw(`concept-${n}.html`, [[new RegExp(`\\s*<div class="actions"><a class="btn navy" href="downloads/onshore-air-concept-${n}-${name}\\.zip">[^<]*<small>[^<]*</small></a></div>`), '']]);
}
rw('guidelines.html', [
  [/<h2>Download packs<\/h2>\s*<p>[^<]*<\/p>/, '<h2>Downloads</h2>\n  <p>The presentation is here as a PDF. The logo file packs (every SVG, PNG versions and a one-page README) are sent once you have chosen a direction, so the right files go to your signwriter and embroiderer.</p>'],
  [/<a href="downloads\/onshore-air-concept-1-evolution\.zip" download>[\s\S]*?<a href="downloads\/onshore-air-logo-concepts-all\.zip" download>[\s\S]*?<\/a>\s*/, '<div style="border:1px solid #e3e6ec;border-radius:14px;padding:14px 18px;background:#fff"><b style="color:#0B1F5C">Logo file packs</b><span style="display:block;color:#5b6475;font-size:13.5px">One pack per concept: SVG + PNG + README. Sent after you choose.</span></div>\n    '],
]);
const left = fs.readdirSync(out, { recursive: true }).filter(f => /\.html$/.test(f)).filter(f => /\.zip/.test(fs.readFileSync(path.join(out, f), 'utf8')));
if (left.length) throw new Error('zip links remain in ' + left.join(', '));
console.log('staged', out, fs.readdirSync(out, { recursive: true }).length, 'entries');
