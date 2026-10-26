const M = require('./marks');
const WHITE = '#FFFFFF';

module.exports = [
  {
    id: 'concept-1-evolution', title: 'Evolution', slug: 'evolution',
    fonts: { name: 'Outfit-800', desc: 'Outfit-600' },
    mark: () => M.evolution({ alpha: 30, amps: [5, 9, 5], edges: [48, 4, -50], gaps: [5.5, 7, 5.5] }),
    monoMark: () => M.evolution({ alpha: 30, amps: [5, 9, 5], edges: [48, 4, -50], gaps: [8, 9, 8] }),
    smallMark: () => M.evolution({ alpha: 30, amps: [4, 7, 4], edges: [50, 4, -52], gaps: [10, 11, 10] }),
    colours: [
      { role: 'navy', name: 'Onshore Navy', hex: '#0B1F5C' },
      { role: 'ocean', name: 'Ocean Blue', hex: '#1E7FD8' },
      { role: 'sun', name: 'Sun Yellow', hex: '#FFC233' },
      { role: 'sunset', name: 'Sunset Orange', hex: '#F5871F' },
    ],
    word: 'navy', desc: 'ocean',
    onNavy: { navy: WHITE, ocean: '#1E7FD8', sun: '#FFC233', sunset: '#F5871F', word: WHITE, desc: '#FFC233' },
    name: { text: 'ONSHORE AIR', tracking: 50, pairs: { RE: 12 } },
    descText: 'AIR CONDITIONING · SUNSHINE COAST', descCap: 0.3,
    stacked: { markH: 3.56, gap: 0.66, ox: 0 },   // round 2: mark +8% so it leads
    horizontal: { markK: 1.22, gap: 0.36, dGap: 0.44, oy: 0 },
    compact: { markK: 2.1, gap: 0.42 },
  },
  {
    id: 'concept-2-horizon', title: 'Horizon', slug: 'horizon',
    fonts: { name: 'Sora-700', desc: 'Sora-600' },
    mark: () => M.horizon({ split: true }),
    monoMark: () => M.horizon({ split: true, gap: 8.5, wg: 8.5, hold: 24, pow: 0.6 }),
    smallMark: () => M.horizon({ split: true, th: 26, gap: 11, wg: 11, xl: -100, wrap: 100, hold: 24, pow: 0.55, A: 3 }),
    colours: [
      { role: 'navy', name: 'Ink Navy', hex: '#0C1C45' },
      { role: 'sun', name: 'Sun Gold', hex: '#F4B23E' },
      { role: 'ocean', name: 'Sea Blue', hex: '#2A7FD4' },
    ],
    word: 'navy', desc: 'ocean',
    onNavy: { navy: WHITE, sun: '#F4B23E', ocean: '#2A7FD4', word: WHITE, desc: '#F4B23E' },
    name: { text: 'ONSHORE AIR', tracking: 150, wordSpace: 60 },
    descText: 'AIR CONDITIONING · SUNSHINE COAST', descCap: 0.33,
    stacked: { markH: 3.8, gap: 0.62, ox: 0, centre: 'blend', blend: 0.8 },
    horizontal: { markK: 1.3, gap: 0.3, dGap: 0.5, oy: 0, align: 'bottom' },
    compact: { markK: 2.0, gap: 0.34, align: 'baseline' },
  },
  {
    id: 'concept-3-monogram', title: 'Monogram', slug: 'monogram',
    fonts: { name: 'RedHatDisplay-900', desc: 'RedHatDisplay-700' },
    mark: () => M.monogram({ r: 67, gap: 7, wg: 7.5, alpha: 30, A: 6.5 }),        // ring 33 (was 38): -13%
    monoMark: () => M.monogram({ r: 67, gap: 9, wg: 9, A: 6.5, dropSea: true }),
    smallMark: () => M.monogram({ r: 66, gap: 10, wg: 10, A: 5 }),
    colours: [
      { role: 'navy', name: 'Royal Navy', hex: '#0A2272' },
      { role: 'sun', name: 'Signal Yellow', hex: '#FFC629' },
      { role: 'ocean', name: 'Coast Blue', hex: '#1B8BE6' },
    ],
    word: 'navy', desc: 'ocean',
    onNavy: { navy: WHITE, sun: '#FFC629', ocean: '#1B8BE6', word: WHITE, desc: '#FFC629' },
    name: { text: 'ONSHORE AIR', tracking: 60, pairs: { RE: 10 } },
    descText: 'AIR CONDITIONING · SUNSHINE COAST', descCap: 0.3,
    stacked: { markH: 3.1, gap: 0.6, ox: 0 },
    horizontal: { markK: 1.2, gap: 0.34, dGap: 0.44, oy: 0 },
    compact: { markK: 1.8, gap: 0.38 },
  },
];
