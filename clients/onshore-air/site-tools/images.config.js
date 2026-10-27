// Photo pipeline config. Every photo is Luke's own, taken from the current Wix site
// (static.wixstatic.com/media/<id>). Originals are downloaded to .cache/ (git-ignored),
// cropped to the aspect the layout uses (focus = focal point 0..1) and exported as WebP + JPEG.
module.exports = {
  quality: { webp: 72, jpg: 76 },
  photos: [
    // Home hero: landscape 4:3 crop around Luke and the unit. It fills the right ~64% of the desktop hero (object-fit
    // cover), with the navy gradient over its left edge; phones use luke-hydro-clean (4:5) via <source media>.
    { name: 'hero-home', id: 'dbd3e8_0324a86c541c40e5a109102c8bbc874a~mv2.png', aspect: [4, 3], focus: [0.5, 0.47], widths: [1000, 1440, 2000] },

    // Inner-page heroes, 3:2: they fill the right ~58% of the 420-520px desktop hero band (object-fit cover) behind the
    // navy gradient, and sit full width above the copy on phones (capped at 900w below 600px by layout.js)
    { name: 'hero-installations', id: 'dbd3e8_4844daecc0cf43e0acab396dba3b5122~mv2.png', aspect: [3, 2], focus: [0.5, 0.36], widths: [600, 900, 1200, 1600] },
    { name: 'hero-repairs', id: 'dbd3e8_301188725a4141579d50e00cb8caeb08~mv2.png', aspect: [3, 2], focus: [0.55, 0.5], widths: [600, 900, 1200, 1600] },
    { name: 'hero-hydro', id: 'dbd3e8_d79928f77f644034959fa0f166ff796e~mv2.jpg', aspect: [3, 2], focus: [0.5, 0.5], widths: [600, 900, 1200, 1600] },
    { name: 'hero-maintenance', id: 'dbd3e8_24ed7d48570349678bc4fb875c7b11a8~mv2.jpg', aspect: [3, 2], focus: [0.45, 0.62], widths: [600, 900, 1200, 1600] },
    { name: 'hero-about', id: 'dbd3e8_0324a86c541c40e5a109102c8bbc874a~mv2.png', aspect: [3, 2], focus: [0.5, 0.42], widths: [600, 900, 1200, 1600] },
    { name: 'hero-contact', id: 'dbd3e8_99869515a89d4cfa8ca81f5b2ff3d770~mv2.png', aspect: [3, 2], focus: [0.42, 0.33], widths: [600, 900, 1200, 1600] },

    // Home service photo cards, 3:2
    { name: 'card-installations', id: 'dbd3e8_5eeb9cbbfa1a4d39a7033c153a567e03~mv2.png', aspect: [3, 2], focus: [0.5, 0.2], widths: [480, 720, 960] },
    { name: 'card-repairs', id: 'dbd3e8_301188725a4141579d50e00cb8caeb08~mv2.png', aspect: [3, 2], focus: [0.55, 0.5], widths: [480, 720, 960] },
    { name: 'card-hydro', id: 'dbd3e8_318414e0324f4b80b0b5df0ba0660475~mv2.png', aspect: [3, 2], focus: [0.55, 0.36], widths: [480, 720, 960] },
    { name: 'card-maintenance', id: 'dbd3e8_7888fe660bd448d6acde19f515b3c722~mv2.png', aspect: [3, 2], focus: [0.5, 0.76], widths: [480, 720, 960] },

    // Service-area band (home) and service-areas page hero: Luke's aerial photo of the coast (1240x698 original; the 1600 is a mild upscale behind a navy overlay)
    { name: 'area-coast', id: 'dbd3e8_a8e58bbb678a4925a2f7bfdd8b0556b9~mv2.jpg', widths: [900, 1240, 1600] },

    // Feature photos (4:5 portrait): home phone hero, Meet Luke / about, install and maintenance splits, about gallery
    { name: 'luke-hydro-clean', id: 'dbd3e8_0324a86c541c40e5a109102c8bbc874a~mv2.png', aspect: [4, 5], focus: [0.5, 0.42], widths: [560, 900, 1100] },
    { name: 'luke-cleaning-coil', id: 'dbd3e8_318414e0324f4b80b0b5df0ba0660475~mv2.png', aspect: [4, 5], focus: [0.6, 0.42], widths: [560, 720, 900, 1120] },
    { name: 'repair-board', id: 'dbd3e8_301188725a4141579d50e00cb8caeb08~mv2.png', aspect: [4, 5], focus: [0.58, 0.5], widths: [560, 900] },
    { name: 'outdoor-weatherboard', id: 'dbd3e8_074f1cfc5f9d44fdbf720c4b52aa656b~mv2.png', aspect: [4, 5], focus: [0.42, 0.62], widths: [560, 900] },

    // Install gallery (4:5)
    { name: 'gallery-split-window', id: 'dbd3e8_5eeb9cbbfa1a4d39a7033c153a567e03~mv2.png', aspect: [4, 5], focus: [0.5, 0.3], widths: [400, 640] },
    { name: 'gallery-white-split', id: 'dbd3e8_99869515a89d4cfa8ca81f5b2ff3d770~mv2.png', aspect: [4, 5], focus: [0.42, 0.35], widths: [400, 640] },
    { name: 'gallery-bedroom', id: 'dbd3e8_e0c5bc023ab04d019071d565d3e404c6~mv2.png', aspect: [4, 5], focus: [0.5, 0.4], widths: [400, 640] },
    { name: 'gallery-twin-fan', id: 'dbd3e8_15d3bd15f514497681660f259a71281c~mv2.png', aspect: [4, 5], focus: [0.5, 0.55], widths: [400, 640] },
    { name: 'gallery-fujitsu', id: 'dbd3e8_8fe9eba1cc4d492c864bbdbef4c6f71e~mv2.png', aspect: [4, 5], focus: [0.5, 0.62], widths: [400, 640] },
    { name: 'gallery-daikin-pipe', id: 'dbd3e8_ea033a410fe14353baa756e5645de997~mv2.png', aspect: [4, 5], focus: [0.5, 0.6], widths: [400, 640] },

    // Hydro clean before / after (same unit), cropped to a matching 5:2 frame. The after photo was taken from further
    // back, so it gets an explicit, tighter crop that registers it on the before photo (the filter divider and the
    // filter frame line up), which the drag comparison slider needs.
    { name: 'hydro-before', id: 'dbd3e8_6ae24edf6c8445aeb32e67495ceac123~mv2.jpg', aspect: [5, 2], focus: [0.5, 0.5], widths: [700, 900, 1200, 1600] },
    { name: 'hydro-after', id: 'dbd3e8_e08455430c354e8c9c4654e0eb35620a~mv2.jpg', aspect: [5, 2], crop: [1890, 756, 234, 66], widths: [700, 900, 1200, 1600] },
  ],
  // Manufacturer logos and the ARC tick, from Luke's current Wix site. Trimmed, flattened on white and exported as PNG at
  // their native resolution (the strip shows them at 22-40 px tall, so every file is at least 2x). crop = [x, y, w, h] as
  // fractions of the original, applied before the trim (Daikin: the wordmark only, not the stacked triangle).
  // The Mitsubishi Electric file on the Wix site is cropped, so it is deliberately not used.
  logos: [
    { name: 'daikin', id: 'dbd3e8_292a25525d1949b8b83fe934f6426eb8~mv2.png', crop: [0, 0, 1, 0.175], label: 'Daikin' },
    { name: 'fujitsu', id: 'dbd3e8_1bee61d418eb4fbbad5d3e986887da58~mv2.png', label: 'Fujitsu' },
    { name: 'mhi', id: 'dbd3e8_9bb16e62f3554146801ef46ddf48c727~mv2.jpg', label: 'Mitsubishi Heavy Industries' },
    { name: 'hisense', id: 'dbd3e8_1fd7771f13944652b9015ed05e0583c8~mv2.png', label: 'Hisense' },
    { name: 'general', id: 'dbd3e8_8889f39a888b4e62ae447af8d6012a1b~mv2.png', label: 'General' },
    { name: 'arc', id: 'dbd3e8_deb9eea600fc4998876130b21d2ecc13~mv2.png', label: 'ARCtick' },
  ],
};
