/**
 * Text messages are cheapest and most reliable when they only use the basic
 * phone alphabet (GSM-7): one message holds 160 characters. A single curly
 * quote, emoji or macron (ā) switches the whole message to another encoding
 * that holds only 70. These helpers keep alert texts in the basic alphabet.
 */

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
};

export function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!GSM_BASIC.includes(char)) return false;
  }
  return true;
}

/** Swaps or strips anything outside the basic phone alphabet. "Māori" becomes "Maori". */
export function toGsm7(text: string): string {
  let result = "";
  for (const original of text) {
    const char = REPLACEMENTS[original] ?? original;
    if (isGsm7(char)) {
      result += char;
      continue;
    }
    // Drop accents and macrons: "ā" splits into "a" plus a mark we can remove.
    const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
    result += plain !== "" && isGsm7(plain) ? plain : "?";
  }
  return result;
}

/** How many text message parts a GSM-7 message will be billed as. */
export function smsParts(text: string): number {
  if (isGsm7(text)) return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}
