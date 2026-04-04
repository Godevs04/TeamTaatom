import type { Area } from "react-easy-crop";

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = url;
  });
}

/**
 * Renders the cropped region from the source image into a JPEG blob.
 * `pixelCrop` must be from `onCropComplete`'s second argument (`croppedAreaPixels`).
 */
export async function getCroppedImageBlob(imageSrc: string, pixelCrop: Area, quality = 0.92): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Crop failed: empty image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export function blobToImageFile(blob: Blob, baseName: string): File {
  const safe = baseName.replace(/[/\\?%*:|"<>]/g, "").slice(0, 80) || "photo";
  const withoutExt = safe.replace(/\.(jpe?g|png|gif|webp)$/i, "");
  return new File([blob], `${withoutExt}-cropped.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
