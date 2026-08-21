// Cap the longest edge of uploaded raster images before base64-encoding them.
// Phone photos and screenshots are routinely 3000–4000px, but the vision models
// we forward them to downsample internally to roughly 1–1.5k px — so any pixels
// beyond that are pure upload weight, which base64 then inflates another ~33%.
// Downscaling here shrinks the request body, speeds the upload, and keeps us
// inside provider payload limits with no loss of OCR fidelity.
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.85; // used for JPEG/WEBP; PNG re-encode ignores it

// Only these raster formats are re-encoded through a <canvas>. We deliberately
// leave everything else untouched and read it verbatim:
//   • PDF / other docs — not images at all
//   • SVG — vector, has no meaningful pixel dimensions
//   • GIF — may be animated; canvas would flatten it to a single frame
// Every caller sends `mimeType: file.type` alongside the data, so we must
// re-encode to the SAME type — otherwise the declared MIME and the actual bytes
// would disagree and the AI request would be corrupt.
const DOWNSCALABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Original behavior, preserved exactly: read the file and return bare base64
// (the "data:<mime>;base64," prefix stripped). This is the fallback for every
// non-image file and whenever downscaling can't be applied safely.
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// Decode a File to a drawable image, preferring the faster createImageBitmap
// and falling back to an <img> + object URL on browsers that lack it.
async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Returns downscaled base64, or null when downscaling shouldn't apply (image is
// already small enough, or the browser couldn't honor the source MIME on encode)
// — in which case the caller reads the file verbatim instead.
async function downscaleImage(file) {
  const bitmap = await loadImage(file);
  const w = bitmap.naturalWidth || bitmap.width;
  const h = bitmap.naturalHeight || bitmap.height;
  if (!w || !h) {
    if (bitmap.close) bitmap.close();
    return null;
  }

  const longest = Math.max(w, h);
  if (longest <= MAX_IMAGE_DIMENSION) {
    // Already within budget — re-encoding would cost a decode/encode cycle for
    // no size win (and for PNG could even grow the file). Read it verbatim.
    if (bitmap.close) bitmap.close();
    return null;
  }

  const scale = MAX_IMAGE_DIMENSION / longest;
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (bitmap.close) bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  if (bitmap.close) bitmap.close();

  const dataUrl = canvas.toDataURL(file.type, IMAGE_QUALITY);
  // If the browser can't encode the requested type it silently returns PNG.
  // Since callers declare the original file.type, that mismatch would corrupt
  // the request — so fall back to a verbatim read when the type isn't honored.
  const declared = dataUrl.slice(5, dataUrl.indexOf(";"));
  if (declared !== file.type) return null;

  return dataUrl.split(",")[1] || null;
}

export function fileToBase64(file) {
  // Downscale large raster images; read everything else verbatim. Any failure
  // in the downscale path (decode error, tainted canvas, out-of-memory, …)
  // falls back to the original read so uploads never break.
  if (file && DOWNSCALABLE_TYPES.has(file.type) && typeof document !== "undefined") {
    return downscaleImage(file)
      .then((base64) => (base64 != null ? base64 : readFileAsBase64(file)))
      .catch(() => readFileAsBase64(file));
  }
  return readFileAsBase64(file);
}

export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file buffer"));
    reader.readAsArrayBuffer(file);
  });
}
