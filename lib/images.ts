/**
 * Client-side image compression for wardrobe thumbnails.
 *
 * Firebase Storage requires the paid Blaze plan on new projects, so images are
 * stored inline in Firestore documents instead — center-cropped to a square,
 * downscaled, and compressed so each thumbnail stays a few tens of KB (well
 * under Firestore's 1 MB doc limit).
 */

const THUMB_SIZE = 384; // px, square
const MAX_DATA_URL_BYTES = 400_000; // hard safety cap

export async function compressImageToThumbnail(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("Please choose a JPG, PNG, or WEBP image.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Image is too large (max 15 MB).");
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  // Center-crop to a square so every thumbnail shares the same aspect ratio.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);

  // Prefer WebP; step quality down until it fits comfortably.
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const out = canvas.toDataURL(type, quality);
      // canvas may silently fall back to png for unsupported types — check.
      if (!out.startsWith(`data:${type}`)) break;
      if (out.length <= MAX_DATA_URL_BYTES) return out;
    }
  }
  throw new Error("Couldn't compress the image enough — try a smaller photo.");
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image."));
    img.src = src;
  });
}
