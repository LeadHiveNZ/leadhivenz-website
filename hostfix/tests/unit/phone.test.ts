import { describe, expect, it } from "vitest";
import { displayPhone, normalisePhone } from "@/lib/phone";

describe("normalisePhone", () => {
  it("reads New Zealand mobiles the way people type them", () => {
    expect(normalisePhone("021 123 4567", "NZ")?.e164).toBe("+64211234567");
    expect(normalisePhone("0211234567", "NZ")?.e164).toBe("+64211234567");
    expect(normalisePhone("(021) 123-4567", "NZ")?.e164).toBe("+64211234567");
    expect(normalisePhone("+64 21 123 4567", "NZ")?.e164).toBe("+64211234567");
  });

  it("reads a New Zealand landline", () => {
    expect(normalisePhone("03 441 0000", "NZ")?.e164).toBe("+6434410000");
  });

  it("reads an Australian mobile typed on a New Zealand page (owners who live in Australia)", () => {
    const phone = normalisePhone("0412 345 678", "NZ");
    expect(phone?.e164).toBe("+61412345678");
    expect(phone?.country).toBe("AU");
  });

  it("reads a number that could belong to either country as the market's own country", () => {
    // "021 123 4567" is a New Zealand mobile, but it is also a valid Sydney landline.
    // On an Australian page it is read as Australian. Typing +64 removes the doubt.
    expect(normalisePhone("021 123 4567", "AU")?.country).toBe("AU");
    expect(normalisePhone("+64 21 123 4567", "AU")?.e164).toBe("+64211234567");
    expect(normalisePhone("021 123 4567", "NZ")?.country).toBe("NZ");
  });

  it("reads numbers from other countries when the +code is given", () => {
    expect(normalisePhone("+44 7911 123456", "NZ")?.e164).toBe("+447911123456");
  });

  it("rejects things that are not phone numbers", () => {
    expect(normalisePhone("", "NZ")).toBeNull();
    expect(normalisePhone("hello", "NZ")).toBeNull();
    expect(normalisePhone("12345", "NZ")).toBeNull();
    expect(normalisePhone("021", "NZ")).toBeNull();
    expect(normalisePhone("9".repeat(60), "NZ")).toBeNull();
  });
});

describe("displayPhone", () => {
  it("shows local numbers the local way", () => {
    expect(displayPhone("+64211234567")).toBe("021 123 4567");
    expect(displayPhone("+61412345678")).toBe("0412 345 678");
  });

  it("shows other numbers in international format", () => {
    expect(displayPhone("+447911123456")).toBe("+44 7911 123456");
  });

  it("leaves unreadable values alone", () => {
    expect(displayPhone("not a number")).toBe("not a number");
  });
});
