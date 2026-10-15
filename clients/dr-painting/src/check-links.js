#!/usr/bin/env node
'use strict';
/* Link checker for the built site. Plain Node, no dependencies.
     node src/check-links.js [siteDir]
   Parses every .html file's href/src (and srcset), and asserts each local
   target file exists, and each #fragment exists as an id in its target page.
   Remote (http/https), tel:, mailto:, sms: and data: URLs are skipped. Exits 1 on any failure. */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'site'));
const htmlFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.html'));
const ids = {};
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
htmlFiles.forEach((f) => { ids[f] = new Set([...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])); });

const SKIP = /^(https?:|tel:|mailto:|sms:|data:|javascript:|\/\/)/i;
let checked = 0;
const fails = [];
for (const f of htmlFiles) {
  const html = read(f);
  const refs = [];
  for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) refs.push(m[2]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) m[1].split(',').forEach((c) => refs.push(c.trim().split(/\s+/)[0]));
  for (let ref of refs) {
    ref = ref.replace(/&amp;/g, '&');
    if (!ref || SKIP.test(ref)) continue;
    checked++;
    if (ref.startsWith('/')) { fails.push(`${f}: root-absolute path "${ref}" (use a relative path)`); continue; }
    const [p0, frag] = ref.split('#');
    const target = p0 ? decodeURIComponent(p0.split('?')[0]) : f;
    const abs = path.join(DIR, target);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { fails.push(`${f}: missing file "${ref}"`); continue; }
    if (frag && target.endsWith('.html') && !ids[target].has(frag)) fails.push(`${f}: "${ref}" has no element with id="${frag}"`);
  }
}
console.log(`Checked ${checked} local links/assets across ${htmlFiles.length} pages.`);
if (fails.length) { console.error('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('OK: every local href/src resolves.');
