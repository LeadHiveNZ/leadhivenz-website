import { describe, expect, it } from "vitest";
import { isGsm7, smsParts, toGsm7 } from "@/lib/notify/gsm";

describe("toGsm7", () => {
  it("leaves plain text alone", () => {
    const text = "HostFix lead: OWNER Sam Smith, 021 123 4567. 2 properties in Queenstown. NZ$49!";
    expect(toGsm7(text)).toBe(text);
    expect(isGsm7(text)).toBe(true);
  });

  it("drops macrons so Māori names and places stay readable", () => {
    expect(toGsm7("Tāne from Taupō, Whangārei, Ōtautahi")).toBe("Tane from Taupo, Whangarei, Otautahi");
  });

  it("swaps curly quotes, long dashes and ellipses for plain ones", () => {
    expect(toGsm7("“O’Brien” – plumber…")).toBe('"O\'Brien" - plumber...');
  });

  it("replaces anything it cannot write, such as emoji", () => {
    expect(toGsm7("Great \u{1F600} job")).toBe("Great ? job");
    expect(isGsm7(toGsm7("\u{1F527} 中文 ok"))).toBe(true);
  });
});

describe("smsParts", () => {
  it("counts one part up to 160 plain characters", () => {
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(306))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
  });

  it("counts only 70 characters a part once a special character appears", () => {
    expect(smsParts("ā".repeat(70))).toBe(1);
    expect(smsParts("ā".repeat(71))).toBe(2);
  });
});
