// Photo pipeline config. Every photo is Luke's own, taken from the current Wix site
// (static.wixstatic.com/media/<id>). Originals are downloaded to .cache/ (git-ignored),
// cropped to the aspect the layout uses (focus = focal point 0..1) and exported as WebP + JPEG.
// The aerial coast photo (dbd3e8_a8e58bbb678a4925a2f7bfdd8b0556b9~mv2.jpg) is only used by og-image.js now.
module.exports = {
  ogPhoto: 'dbd3e8_a8e58bbb678a4925a2f7bfdd8b0556b9~mv2.jpg',
  quality: { webp: 72, jpg: 76 },
  photos: [
    // Home services index thumbnails, 4:3 (140x105 on desktop; phones show a 72 px square crop of the same file)
    { name: 'thumb-installations', id: 'dbd3e8_5eeb9cbbfa1a4d39a7033c153a567e03~mv2.png', aspect: [4, 3], focus: [0.5, 0.22], widths: [144, 280, 420] },
    { name: 'thumb-repairs', id: 'dbd3e8_301188725a4141579d50e00cb8caeb08~mv2.png', aspect: [4, 3], focus: [0.55, 0.5], widths: [144, 280, 420] },
    { name: 'thumb-hydro', id: 'dbd3e8_d79928f77f644034959fa0f166ff796e~mv2.jpg', aspect: [4, 3], focus: [0.45, 0.42], widths: [144, 280, 420] },
    { name: 'thumb-maintenance', id: 'dbd3e8_7888fe660bd448d6acde19f515b3c722~mv2.png', aspect: [4, 3], focus: [0.5, 0.74], widths: [144, 280, 420] },

    // Feature / page-hero photos (4:5 portrait)
    { name: 'luke-hydro-clean', id: 'dbd3e8_0324a86c541c40e5a109102c8bbc874a~mv2.png', aspect: [4, 5], focus: [0.5, 0.42], widths: [560, 900, 1100] },
    { name: 'luke-cleaning-coil', id: 'dbd3e8_318414e0324f4b80b0b5df0ba0660475~mv2.png', aspect: [4, 5], focus: [0.6, 0.42], widths: [560, 900] },
    { name: 'black-split', id: 'dbd3e8_4844daecc0cf43e0acab396dba3b5122~mv2.png', aspect: [4, 5], focus: [0.5, 0.38], widths: [560, 900] },
    { name: 'repair-board', id: 'dbd3e8_301188725a4141579d50e00cb8caeb08~mv2.png', aspect: [4, 5], focus: [0.58, 0.5], widths: [560, 900] },
    { name: 'outdoor-daikin', id: 'dbd3e8_24ed7d48570349678bc4fb875c7b11a8~mv2.jpg', aspect: [4, 5], focus: [0.42, 0.6], widths: [560, 900] },
    { name: 'outdoor-weatherboard', id: 'dbd3e8_074f1cfc5f9d44fdbf720c4b52aa656b~mv2.png', aspect: [4, 5], focus: [0.42, 0.62], widths: [560, 900] },
    { name: 'outdoor-fujitsu', id: 'dbd3e8_8fe9eba1cc4d492c864bbdbef4c6f71e~mv2.png', aspect: [1, 1], focus: [0.5, 0.74], widths: [400, 640] },

    // Install gallery (4:5)
    { name: 'gallery-split-window', id: 'dbd3e8_5eeb9cbbfa1a4d39a7033c153a567e03~mv2.png', aspect: [4, 5], focus: [0.5, 0.3], widths: [400, 640] },
    { name: 'gallery-white-split', id: 'dbd3e8_99869515a89d4cfa8ca81f5b2ff3d770~mv2.png', aspect: [4, 5], focus: [0.42, 0.35], widths: [400, 640] },
    { name: 'gallery-bedroom', id: 'dbd3e8_e0c5bc023ab04d019071d565d3e404c6~mv2.png', aspect: [4, 5], focus: [0.5, 0.4], widths: [400, 640] },
    { name: 'gallery-twin-fan', id: 'dbd3e8_15d3bd15f514497681660f259a71281c~mv2.png', aspect: [4, 5], focus: [0.5, 0.55], widths: [400, 640] },
    { name: 'gallery-fujitsu', id: 'dbd3e8_8fe9eba1cc4d492c864bbdbef4c6f71e~mv2.png', aspect: [4, 5], focus: [0.5, 0.62], widths: [400, 640] },
    { name: 'gallery-daikin-pipe', id: 'dbd3e8_ea033a410fe14353baa756e5645de997~mv2.png', aspect: [4, 5], focus: [0.5, 0.6], widths: [400, 640] },

    // Hydro clean before / after (same unit), cropped to a matching 5:2 frame
    { name: 'hydro-before', id: 'dbd3e8_6ae24edf6c8445aeb32e67495ceac123~mv2.jpg', aspect: [5, 2], focus: [0.5, 0.5], widths: [700, 1200] },
    { name: 'hydro-after', id: 'dbd3e8_e08455430c354e8c9c4654e0eb35620a~mv2.jpg', aspect: [5, 2], focus: [0.5, 0.5], widths: [700, 1200] },
  ],
};
