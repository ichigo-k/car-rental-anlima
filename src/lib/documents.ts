import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { detectImage } from "./photos";

// Customer licence and Ghana Card scans. Each file is encrypted with
// AES-256-GCM before it is written, with a key derived from the identity
// secret, so a copy of the disk or a backup alone cannot be read.
export const DOCUMENT_KINDS = {
  LICENCE_FRONT: "Driving licence (front)",
  LICENCE_BACK: "Driving licence (back)",
  ID_FRONT: "Ghana Card (front)",
  ID_BACK: "Ghana Card (back)",
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;
export const isDocumentKind = (k: unknown): k is DocumentKind =>
  typeof k === "string" && k in DOCUMENT_KINDS;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const REJECTED_KEPT_DAYS = 30;
const KEY = /^documents\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.bin$/;
export class DocumentError extends Error {}

const dir = () =>
  process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
function key() {
  const secret =
    process.env.IDENTITY_ENCRYPTION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new DocumentError("Document storage is not configured.");
  return Buffer.from(
    hkdfSync("sha256", secret, "anlima-documents-v1", "customer-documents", 32),
  );
}

export function documentType(bytes: Uint8Array) {
  const image = detectImage(bytes);
  if (image) return image.contentType;
  // %PDF-
  if ([0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => bytes[i] === b))
    return "application/pdf";
  return null;
}

// File layout: 12-byte IV, 16-byte auth tag, ciphertext.
export function encrypt(bytes: Uint8Array) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
export function decrypt(data: Uint8Array) {
  const buf = Buffer.from(data);
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export async function saveDocumentFile(bytes: Uint8Array, now = new Date()) {
  if (!bytes.length) throw new DocumentError("The file is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES)
    throw new DocumentError("Each document must be 8 MB or smaller.");
  const contentType = documentType(bytes);
  if (!contentType)
    throw new DocumentError("Upload a photo (JPEG, PNG or WebP) or a PDF.");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storageKey = `documents/${now.getUTCFullYear()}/${month}/${randomUUID()}.bin`;
  const file = path.join(dir(), storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encrypt(bytes), { flag: "wx", mode: 0o600 });
  return {
    storageKey,
    contentType,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function readDocumentFile(storageKey: string) {
  if (!KEY.test(storageKey)) throw new DocumentError("Unknown document.");
  return decrypt(await readFile(path.join(dir(), storageKey)));
}
export async function deleteDocumentFile(storageKey: string) {
  if (KEY.test(storageKey))
    await rm(path.join(dir(), storageKey), { force: true });
}

// Saves a customer's document, replacing (and deleting) their previous one of
// the same kind.
export async function storeDocument(
  db: PrismaClient,
  userId: string,
  kind: DocumentKind,
  bytes: Uint8Array,
) {
  const saved = await saveDocumentFile(bytes);
  try {
    const previous = await db.customerDocument.findUnique({
      where: { userId_kind: { userId, kind } },
    });
    const doc = await db.customerDocument.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, ...saved },
      update: {
        ...saved,
        status: "PENDING",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
      },
    });
    if (previous) await deleteDocumentFile(previous.storageKey);
    return doc;
  } catch (e) {
    await deleteDocumentFile(saved.storageKey);
    throw e;
  }
}

export async function removeDocument(
  db: PrismaClient,
  doc: { id: string; storageKey: string },
) {
  await db.customerDocument.delete({ where: { id: doc.id } });
  await deleteDocumentFile(doc.storageKey);
}

// Rejected documents are kept for 30 days so the customer can see why, then
// deleted.
export async function removeOldRejectedDocuments(
  db: PrismaClient,
  now = new Date(),
) {
  const old = await db.customerDocument.findMany({
    where: {
      status: "REJECTED",
      reviewedAt: {
        lt: new Date(now.getTime() - REJECTED_KEPT_DAYS * 86400000),
      },
    },
    take: 200,
  });
  for (const doc of old) await removeDocument(db, doc);
  return old.length;
}

// Licence and Ghana Card status for a customer, from both sides: approved,
// awaiting review, rejected, one side missing, or not uploaded.
export type DocumentState =
  "APPROVED" | "PENDING" | "REJECTED" | "INCOMPLETE" | "MISSING";
export type DocumentSummary = Record<"licence" | "id", DocumentState>;
export function documentSummary(
  docs: { kind: string; status: string }[],
): DocumentSummary {
  const of = (front: DocumentKind, back: DocumentKind): DocumentState => {
    const pair = [front, back].map(
      (k) => docs.find((d) => d.kind === k)?.status ?? "MISSING",
    );
    if (pair.includes("REJECTED")) return "REJECTED";
    if (pair.every((s) => s === "MISSING")) return "MISSING";
    if (pair.includes("MISSING")) return "INCOMPLETE";
    if (pair.includes("PENDING")) return "PENDING";
    return "APPROVED";
  };
  return {
    licence: of("LICENCE_FRONT", "LICENCE_BACK"),
    id: of("ID_FRONT", "ID_BACK"),
  };
}
