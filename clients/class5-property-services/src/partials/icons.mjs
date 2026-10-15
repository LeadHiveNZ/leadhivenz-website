// Custom line icons: 24px grid, 1.75 stroke, currentColor (pink on dark, ink on light via CSS).
const P = {
  tv: '<rect x="2.5" y="4" width="19" height="12.5" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/><path d="M6 7.5h3" opacity=".6"/>',
  plaster: '<path d="M14.5 3.5l6 6-9.5 9.5H5v-6z"/><path d="M11.5 6.5l6 6M5 19l-2 2"/><path d="M8.5 13.5h3v3" opacity=".6"/>',
  cabinet: '<rect x="4" y="3" width="16" height="15" rx="1"/><path d="M12 3v15M4 10.5h8M10 13.5v1.5M14 13.5v1.5M6.5 18v2.5M17.5 18v2.5"/>',
  deck: '<path d="M3 8h7.5M13 8h8M3 12h12M17.5 12H21M3 16h5M10.5 16H21M6 16v5M18 16v5"/><path d="M12 3.5v4.5" opacity=".6"/>',
  fence: '<path d="M4 21V7l2-2.5L8 7v14M10 21V7l2-2.5L14 7v14M16 21V7l2-2.5L20 7v14"/><path d="M2.5 10.5H4M8 10.5h2M14 10.5h2M20 10.5h1.5M2.5 16.5H4M8 16.5h2M14 16.5h2M20 16.5h1.5"/>',
  key: '<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><circle cx="10" cy="15" r="2"/><path d="M12 15h4.5v2"/>',
  wrench: '<path d="M14.6 6.3a4.2 4.2 0 0 0 5 5.4l-.1-.1-2.4-.4-.4-2.4 2.5-2.5a4.2 4.2 0 0 0-5.4 5L4.6 20.4a1.6 1.6 0 0 1-2.2-2.2l9.7-9.7"/>',
  phone: '<path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.6-3 19.3 19.3 0 0 1-6-6A19.6 19.6 0 0 1 1.2 3.7 2 2 0 0 1 3.2 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L7.2 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.6 2z"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="1.5"/><path d="M3 6l9 7 9-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M12 21.5s-7-6.2-7-11.8a7 7 0 0 1 14 0c0 5.6-7 11.8-7 11.8z"/><circle cx="12" cy="9.5" r="2.5"/>',
  camera: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.5-2.5h7L17 7h2.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M3 7h18M3 12h18M3 17h18"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  quote: '<path d="M9.5 6.5C6 7.5 4 10 4 13.5V18h5.5v-5.5H6.5c0-2.5 1.2-4 3.5-4.5zM19.5 6.5C16 7.5 14 10 14 13.5V18h5.5v-5.5h-3c0-2.5 1.2-4 3.5-4.5z"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.5"/>',
  broom: '<path d="M14 3l-3.5 8.5M7 11.5h8l1.5 9.5h-11z"/><path d="M9.5 15.5v5M12.5 15.5v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6"/>',
};

export function icon(name, cls = 'icon', label = '') {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${P[name]}</svg>`;
}
