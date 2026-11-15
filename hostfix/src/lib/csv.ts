/**
 * Builds a CSV file that opens cleanly in Excel, Numbers and Google Sheets.
 *
 * Safety: leads type their own names, so a cell could start with "=" and be
 * run as a formula when you open the file. Any cell that starts with a formula
 * character is given a leading apostrophe so it is treated as plain text.
 * Phone numbers such as +64211234567 are left alone: they are only digits.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?[0-9][0-9 .,()-]*$/;

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // The leading marker tells Excel the file is UTF-8, so macrons survive.
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
