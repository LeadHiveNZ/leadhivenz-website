/**
 * PASTE A SPREADSHEET OF PROPERTIES (DECISIONS.md, 2026-11-18).
 *
 * One property per line: name, street address, suburb, postcode, access
 * notes. Columns are separated by tabs (what a spreadsheet gives you when you
 * copy cells) or by commas. A first line that looks like column headings is
 * skipped. Each line is checked the same way the Add a property form checks
 * it, and the problems are said per line, before anything is saved.
 *
 * No server code here: the screen uses it to show the preview as the person
 * pastes, and the server uses it again when they save.
 */

export const IMPORT_MAX_ROWS = 200;

export type ImportRow = {
  /** The line number in what was pasted, counting from 1. */
  line: number;
  name: string;
  addressLine1: string;
  suburb: string;
  postcode: string;
  accessNotes: string;
  problems: string[];
};

export type ImportResult = { rows: ImportRow[]; tooMany: boolean };

/** Splits one line on commas, keeping commas inside "double quotes" together. */
function splitCommas(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out;
}

function splitLine(line: string): string[] {
  const cells = line.includes("\t") ? line.split("\t") : splitCommas(line);
  return cells.map((cell) => cell.replace(/^"(.*)"$/s, "$1").replace(/\s+/g, " ").trim());
}

const HEADINGS = /^(name|property|property name|house)$/i;

export function parsePropertyRows(pasted: string): ImportResult {
  const lines = pasted.replace(/\r\n?/g, "\n").split("\n");
  const rows: ImportRow[] = [];
  let tooMany = false;
  lines.forEach((raw, index) => {
    if (raw.trim() === "") return;
    const cells = splitLine(raw);
    if (rows.length === 0 && HEADINGS.test(cells[0] ?? "") && /address|street/i.test(cells[1] ?? "")) return;
    if (rows.length >= IMPORT_MAX_ROWS) {
      tooMany = true;
      return;
    }
    const [name = "", addressLine1 = "", suburb = "", postcode = "", ...rest] = cells;
    const accessNotes = rest.join(", ").trim();
    const problems: string[] = [];
    if (name.length < 1) problems.push("No name.");
    else if (name.length > 80) problems.push("The name is longer than 80 letters.");
    if (addressLine1.length < 3) problems.push("No street address.");
    else if (addressLine1.length > 120) problems.push("The street address is longer than 120 letters.");
    if (suburb.length < 2) problems.push("No suburb or town.");
    else if (suburb.length > 60) problems.push("The suburb is longer than 60 letters.");
    if (postcode.length > 10) problems.push("The postcode is longer than 10 characters.");
    if (accessNotes.length > 1500) problems.push("The access notes are longer than 1500 letters.");
    rows.push({ line: index + 1, name, addressLine1, suburb, postcode, accessNotes, problems });
  });
  return { rows, tooMany };
}
