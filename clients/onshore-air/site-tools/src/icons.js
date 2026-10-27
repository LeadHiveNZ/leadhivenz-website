// Small 24x24 stroke icon set, inlined as SVG (no icon font, no external sprite).
// Functional icons (24x24, 1.5px stroke) plus the shield used as a trust mark.
const P = {
  phone: '<path d="M5.2 3.5h3.1l1.7 4.4-2.3 1.4a11.6 11.6 0 0 0 7 7l1.4-2.3 4.4 1.7v3.1a1.9 1.9 0 0 1-2 1.9A16.6 16.6 0 0 1 3.3 5.5a1.9 1.9 0 0 1 1.9-2z"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  shield: '<path d="M12 2.8l7.5 2.9v5.6c0 4.8-3.1 8.4-7.5 9.9-4.4-1.5-7.5-5.1-7.5-9.9V5.7z"/><path d="M8.4 12.1l2.5 2.5 4.8-4.9"/>',
  arrows: '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>',
};

function icon(name, cls = '') {
  const body = P[name];
  if (!body) throw new Error('unknown icon ' + name);
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
module.exports = { icon };
