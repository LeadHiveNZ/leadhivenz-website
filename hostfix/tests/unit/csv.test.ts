import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves simple values alone", () => {
    expect(csvCell("Olive Owner")).toBe("Olive Owner");
    expect(csvCell(2)).toBe("2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Smith, Sam")).toBe('"Smith, Sam"');
    expect(csvCell('Sam "the fixer"')).toBe('"Sam ""the fixer"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("defuses cells that a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://evil.example\",\"click\")")).toBe('"\'=HYPERLINK(""http://evil.example"",""click"")"');
    expect(csvCell("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-2+3+cmd")).toBe("'-2+3+cmd");
    expect(csvCell("\tTabbed")).toBe("'\tTabbed");
  });

  it("keeps phone numbers and plain numbers usable", () => {
    expect(csvCell("+64211234567")).toBe("+64211234567");
    expect(csvCell("+61 412 345 678")).toBe("+61 412 345 678");
    expect(csvCell("-49")).toBe("-49");
  });
});

describe("toCsv", () => {
  it("builds a file Excel reads as UTF-8", () => {
    const csv = toCsv([
      ["Name", "Phone"],
      ["Tāne", "+64221234567"],
    ]);
    expect(csv).toBe("﻿Name,Phone\r\nTāne,+64221234567\r\n");
  });
});
