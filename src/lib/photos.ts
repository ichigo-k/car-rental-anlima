import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

// Handover and return photos are stored on the server's disk, outside the
// public folder, and served only to staff. Set UPLOAD_DIR on the server; the
// default is ./storage/uploads (ignored by git and kept across deploys).
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MIN_INSPECTION_PHOTOS = 1;
export const MAX_INSPECTION_PHOTOS = 20;
const ABANDONED_AFTER_MS = 24 * 3600000;

const uploadDir = () =>
  process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
const KEY = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

// The type comes from the file's first bytes, never from its name or the
// browser's label.
export function detectImage(bytes: Uint8Array) {
  const at = (i: number, ...values: number[]) =>
    values.every((v, j) => bytes[i + j] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", ext: "jpg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { contentType: "image/png", ext: "png" };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return { contentType: "image/webp", ext: "webp" };
  return null;
}

export class PhotoError extends Error {}

export async function savePhoto(bytes: Uint8Array, now = new Date()) {
  if (!bytes.length) throw new PhotoError("The photo is empty.");
  if (bytes.length > MAX_PHOTO_BYTES)
    throw new PhotoError("Each photo must be 5 MB or smaller.");
  const type = detectImage(bytes);
  if (!type) throw new PhotoError("Upload a JPEG, PNG or WebP photo.");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storageKey = `${now.getUTCFullYear()}/${month}/${randomUUID()}.${type.ext}`;
  const file = path.join(uploadDir(), storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
  return {
    storageKey,
    contentType: type.contentType,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readPhoto(storageKey: string) {
  if (!KEY.test(storageKey)) throw new PhotoError("Unknown photo.");
  return readFile(path.join(uploadDir(), storageKey));
}

export async function deletePhotoFile(storageKey: string) {
  if (KEY.test(storageKey))
    await rm(path.join(uploadDir(), storageKey), { force: true });
}

// Photos uploaded for an inspection that was never saved.
export async function removeAbandonedPhotos(
  db: PrismaClient,
  now = new Date(),
) {
  const stale = await db.inspectionPhoto.findMany({
    where: {
      inspectionId: null,
      createdAt: { lt: new Date(now.getTime() - ABANDONED_AFTER_MS) },
    },
    select: { id: true, storageKey: true },
    take: 500,
  });
  for (const photo of stale) await deletePhotoFile(photo.storageKey);
  await db.inspectionPhoto.deleteMany({
    where: { id: { in: stale.map((p) => p.id) } },
  });
  return stale.length;
}
