import { pdf } from "pdf-to-img";

/**
 * Converts a PDF Buffer or base64 string into base64 PNG data URLs.
 * @param {Buffer|string} pdfInput PDF Buffer or base64 string
 * @param {number} maxPages Maximum pages to convert (default 2 to stay within Groq free TPM limits)
 * @returns {Promise<Array<string>>} Array of data:image/png;base64,... data URLs
 */
export async function pdfToImages(pdfInput, maxPages = 2) {
  try {
    const buffer = Buffer.isBuffer(pdfInput)
      ? pdfInput
      : Buffer.from(pdfInput, "base64");

    // scale: 1.5 — still readable for OCR, far fewer tokens than scale: 2
    const document = await pdf(buffer, { scale: 1.5 });
    const images = [];
    let count = 0;

    for await (const page of document) {
      if (count >= maxPages) break;
      images.push(`data:image/png;base64,${page.toString("base64")}`);
      count++;
    }
    return images;
  } catch (err) {
    console.warn("[pdfToImages] Error converting PDF to page images:", err?.message || err);
    return [];
  }
}
