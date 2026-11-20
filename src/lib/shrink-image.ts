// Resizes a photo in the browser before upload: smaller files on mobile data,
// and re-encoding drops hidden metadata such as the phone's location. PDFs
// and anything the browser cannot read are uploaded as they are.
export async function shrinkImage(
  file: File,
  maxSide = 1600,
  quality = 0.82,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("resize failed"))),
        "image/jpeg",
        quality,
      ),
    );
  } catch {
    return file;
  }
}
