import { deflateSync } from "node:zlib";

/**
 * Makes a small stand-in photo for the demo, so job pages have something to
 * show where a tradie's photo would be. It draws a tiled wall in soft
 * colours. No real photos are shipped with the app.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

type Rgb = [number, number, number];

const PALETTES: Record<"before" | "after" | "found", { wall: Rgb; far: Rgb; line: Rgb; thing: Rgb }> = {
  before: { wall: [214, 205, 196], far: [176, 164, 156], line: [150, 138, 130], thing: [92, 74, 70] },
  after: { wall: [222, 236, 230], far: [186, 214, 204], line: [150, 186, 174], thing: [59, 30, 63] },
  found: { wall: [240, 226, 196], far: [220, 196, 150], line: [190, 164, 116], thing: [140, 84, 40] },
};

export function demoPhoto(kind: "before" | "after" | "found", width = 480, height = 360): Uint8Array {
  const palette = PALETTES[kind];
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const t = (x / width) * 0.55 + (y / height) * 0.45;
      let colour: Rgb = [mix(palette.wall[0], palette.far[0], t), mix(palette.wall[1], palette.far[1], t), mix(palette.wall[2], palette.far[2], t)];
      // Tile lines.
      if (x % 80 < 2 || y % 80 < 2) colour = palette.line;
      // A pipe and a fitting, so it reads as "something on a wall".
      const inPipe = x > width * 0.62 && x < width * 0.68 && y > height * 0.1;
      const inFitting = (x - width * 0.65) ** 2 + (y - height * 0.42) ** 2 < (height * 0.11) ** 2;
      if (inPipe || inFitting) colour = palette.thing;
      const at = row + 1 + x * 3;
      raw[at] = colour[0];
      raw[at + 1] = colour[1];
      raw[at + 2] = colour[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // colour type: RGB
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]),
  );
}
