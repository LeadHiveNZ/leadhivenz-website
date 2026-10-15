import { site } from '../data/site.mjs';
import { esc } from './util.mjs';

const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap';

export function head({ title, desc, path, noindex = false, jsonld, assetV, preload = '' }) {
  const url = site.url + path;
  const og = `${site.url}/og-default.jpg`;
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<meta name="theme-color" content="#0B0B0D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="en_NZ">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Class 5 Property Services logo">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONTS}">
<link rel="stylesheet" href="${FONTS}">
${preload}<link rel="stylesheet" href="/css/style.css?v=${assetV.css}">
<script>document.documentElement.classList.add('js')</script>
<script src="/js/main.js?v=${assetV.js}" defer></script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;
}
