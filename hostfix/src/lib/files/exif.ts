/**
 * WHEN A PHOTO SAYS IT WAS TAKEN (DECISIONS.md, 2026-11-19).
 *
 * Phone cameras write the moment a photo was taken into the JPEG file itself
 * ("EXIF DateTimeOriginal"). The phone reads it here, before the photo is
 * shrunk (shrinking redraws the picture and drops this information), and
 * sends just the time with the upload. It is a cheap check for a photo that
 * was clearly not taken for this job: one taken before the job was logged.
 *
 * Honest limits: a screenshot, a photo saved from a chat app, or a PNG has no
 * such date, and anyone determined can change it. No date is not a flag. No
 * library is needed: this reads only the few bytes it wants.
 *
 * The format (from the EXIF 2.32 standard): a JPEG holds an APP1 block that
 * starts "Exif\0\0", then a TIFF header ("II" for little-endian or "MM" for
 * big-endian, 42, the offset of the first list of tags). Tag 0x8769 in that
 * list points to the camera's own list, where 0x9003 is DateTimeOriginal
 * ("2026:11:19 14:05:09") and 0x9011 its time zone ("+13:00"). 0x0132 in the
 * first list is the file's last-changed time, used when there is nothing else.
 */

export type ExifTime = { local: string; offset: string | null };

/** Reads the time a JPEG says it was taken. Null for anything else, or a photo with no time in it. */
export function exifTakenAt(bytes: Uint8Array): ExifTime | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xda || marker === 0xd9) return null; // the picture itself starts: no EXIF block before it
    const size = view.getUint16(at + 2);
    if (marker === 0xe1 && at + 10 <= bytes.length && String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === "Exif") {
      return readTiff(view, at + 10, Math.min(bytes.length, at + 2 + size));
    }
    at += 2 + size;
  }
  return null;
}

function readTiff(view: DataView, start: number, end: number): ExifTime | null {
  if (start + 8 > end) return null;
  const order = view.getUint16(start);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (offset: number) => (offset + 2 <= end ? view.getUint16(offset, little) : null);
  const u32 = (offset: number) => (offset + 4 <= end ? view.getUint32(offset, little) : null);
  if (u16(start + 2) !== 42) return null;

  /** The tags in one list, as tag -> where its value is. */
  const list = (offset: number): Map<number, { type: number; count: number; valueAt: number }> => {
    const tags = new Map<number, { type: number; count: number; valueAt: number }>();
    const count = u16(start + offset);
    if (count === null || count > 500) return tags;
    for (let index = 0; index < count; index += 1) {
      const entry = start + offset + 2 + index * 12;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const n = u32(entry + 4);
      if (tag === null || type === null || n === null) break;
      // Values longer than 4 bytes are stored elsewhere, and the entry holds their offset.
      const valueAt = type === 2 && n > 4 ? start + (u32(entry + 8) ?? 0) : entry + 8;
      tags.set(tag, { type, count: n, valueAt });
    }
    return tags;
  };
  const ascii = (entry: { type: number; count: number; valueAt: number } | undefined): string | null => {
    if (!entry || entry.type !== 2 || entry.valueAt + entry.count > end) return null;
    let out = "";
    for (let index = 0; index < entry.count; index += 1) {
      const code = view.getUint8(entry.valueAt + index);
      if (code === 0) break;
      out += String.fromCharCode(code);
    }
    return out.trim();
  };

  const first = u32(start + 4);
  if (first === null) return null;
  const ifd0 = list(first);
  const pointer = ifd0.get(0x8769);
  const camera = pointer ? list(view.getUint32(pointer.valueAt, little)) : new Map();
  const original = ascii(camera.get(0x9003)) ?? ascii(ifd0.get(0x0132));
  const match = original?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  if (y === "0000") return null;
  const offset = ascii(camera.get(0x9011));
  return { local: `${y}-${mo}-${d}T${h}:${mi}:${s}`, offset: offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null };
}

/**
 * The moment as a real time. With the photo's own time zone when it has one;
 * otherwise the phone's, which is where the photo was taken nearly always.
 */
export function exifToDate(time: ExifTime): Date | null {
  if (time.offset) {
    const at = new Date(`${time.local}${time.offset}`);
    return Number.isFinite(at.getTime()) ? at : null;
  }
  const [date, clock] = time.local.split("T");
  const [y, mo, d] = date!.split("-").map(Number);
  const [h, mi, s] = clock!.split(":").map(Number);
  const at = new Date(y!, mo! - 1, d!, h!, mi!, s!);
  return Number.isFinite(at.getTime()) ? at : null;
}
