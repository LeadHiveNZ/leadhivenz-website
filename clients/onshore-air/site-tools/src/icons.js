// Small hand-drawn 24x24 stroke icon set, inlined as SVG (no icon font, no external sprite).
const P = {
  phone: '<path d="M5.2 3.5h3.1l1.7 4.4-2.3 1.4a11.6 11.6 0 0 0 7 7l1.4-2.3 4.4 1.7v3.1a1.9 1.9 0 0 1-2 1.9A16.6 16.6 0 0 1 3.3 5.5a1.9 1.9 0 0 1 1.9-2z"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  star: '<path fill="currentColor" stroke="none" d="M12 2.8l2.8 5.9 6.4.7-4.8 4.4 1.4 6.4L12 16.9l-5.8 3.3 1.4-6.4-4.8-4.4 6.4-.7z"/>',
  shield: '<path d="M12 3l7 3v5.6c0 4.5-3 8-7 9.4-4-1.4-7-4.9-7-9.4V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7 21l5-2.6 5 2.6-1.6-7.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  badge: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.6 16.2c.6-1.4 1.7-2.1 2.9-2.1s2.3.7 2.9 2.1M14 10h4M14 13.5h3"/>',
  pin: '<path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.8 6.8 12 13l8.2-6.2"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.6 4.6 12 6l2.4-1.4M9.6 19.4 12 18l2.4 1.4M4.6 11.1 5.8 9.5 5.6 7.6M19.4 12.9l-1.2 1.6.2 1.9M19.4 11.1l-1.2-1.6.2-1.9M4.6 12.9l1.2 1.6-.2 1.9"/>',
  wrench: '<path d="M14.6 6.1a4.2 4.2 0 0 0-5.3 5.4L3.8 17a1.8 1.8 0 0 0 2.6 2.6l5.5-5.5a4.2 4.2 0 0 0 5.4-5.3l-2.6 2.6-2.3-.5-.5-2.3z"/>',
  drop: '<path d="M12 3.2s6.2 6.5 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.7 12 3.2 12 3.2z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.7"/>',
  clipboard: '<rect x="4.5" y="4.5" width="15" height="16.5" rx="2.5"/><path d="M9 3h6v3H9zM8.8 13.2l2.3 2.3 4.3-4.4"/>',
  thermo: '<path d="M14 14.6V5.2a2 2 0 0 0-4 0v9.4a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
  noise: '<path d="M4 9.5v5h3.6L13 19V5L7.6 9.5z"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  alert: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  power: '<path d="M12 3v8"/><path d="M7.3 6.7a7 7 0 1 0 9.4 0"/>',
  wind: '<path d="M3 8.5h10.5a2.8 2.8 0 1 0-2.8-2.8M3 12.5h14.5a2.8 2.8 0 1 1-2.8 2.8M3 16.5h6.5"/>',
  leaf: '<path d="M5 19.5C5 11 10.6 5 20 4.5c-.4 9.3-6.4 15-15 15z"/><path d="M5 19.5l7.5-7.5"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M14.9 9.3c-.5-1-1.6-1.6-2.9-1.6-1.7 0-2.9.9-2.9 2.1 0 2.9 6 1.6 6 4.4 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.7-3.1-1.7M12 6v1.7M12 16.4V18"/>',
  home: '<path d="M4 10.8 12 4l8 6.8"/><path d="M6 9.4V20h12V9.4M10 20v-5.5h4V20"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/>',
  waves: '<path d="M3 8c1.5 0 1.5-1.5 3-1.5S7.5 8 9 8s1.5-1.5 3-1.5S13.5 8 15 8s1.5-1.5 3-1.5S19.5 8 21 8M3 13c1.5 0 1.5-1.5 3-1.5S7.5 13 9 13s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5M3 18c1.5 0 1.5-1.5 3-1.5S7.5 18 9 18s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5"/>',
  sparkle: '<path d="M12 3.5l1.9 5.2 5.1 1.8-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  building: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l1.8 1.8"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6c2.3.1 4 1.5 4.7 4"/>',
  filter: '<path d="M4 5h16l-6.2 7.5V19l-3.6-1.8v-4.7z"/>',
  multi: '<rect x="2.5" y="3.5" width="8.5" height="4.5" rx="1.2"/><rect x="13" y="3.5" width="8.5" height="4.5" rx="1.2"/><rect x="7" y="14.5" width="10" height="6.5" rx="1.5"/><path d="M6.8 8v3.2h10.4V8M12 11.2v3.3"/><circle cx="12" cy="17.8" r="1.6"/>',
  bolt: '<path d="M13.5 3 5.5 13.5h6L10.5 21l8-10.5h-6z"/>',
  gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.5l4-4.5"/><circle cx="12" cy="14" r="1.4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  tools: '<path d="M14.6 6.1a4.2 4.2 0 0 0-5.3 5.4L3.8 17a1.8 1.8 0 0 0 2.6 2.6l5.5-5.5a4.2 4.2 0 0 0 5.4-5.3l-2.6 2.6-2.3-.5-.5-2.3z"/>',
  quote: '<path fill="currentColor" stroke="none" d="M9.8 6.5C6.6 7.6 4.5 10.3 4.5 13.6v3.9h5.6v-5.6H7.6c.2-1.8 1.4-3.2 3.1-3.9zM19.3 6.5c-3.2 1.1-5.3 3.8-5.3 7.1v3.9h5.6v-5.6h-2.5c.2-1.8 1.4-3.2 3.1-3.9z"/>',
};

function icon(name, cls = '') {
  const body = P[name];
  if (!body) throw new Error('unknown icon ' + name);
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
module.exports = { icon };
