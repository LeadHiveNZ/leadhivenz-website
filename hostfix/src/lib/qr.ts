import QRCode from "qrcode";

/**
 * QR CODES for the report link in each property. Made here on the server as a
 * drawing (SVG), so it prints sharply at any size and nothing is sent to an
 * outside QR service.
 */
export async function qrSvg(text: string, options: { dark?: string; light?: string } = {}): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: options.dark ?? "#000000", light: options.light ?? "#ffffff" },
  });
}
