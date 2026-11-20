import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.IDENTITY_ENCRYPTION_SECRET =
  "unit-test-secret-of-at-least-32-characters!";
test("documents are encrypted, and tampering or a wrong key is detected", async () => {
  const { encrypt, decrypt } = await import("../src/lib/documents");
  const plain = new TextEncoder().encode("%PDF-1.7 licence D123456");
  const sealed = encrypt(plain);
  assert.ok(!Buffer.from(sealed).includes(Buffer.from("D123456")));
  assert.deepEqual(new Uint8Array(decrypt(sealed)), plain);
  const tampered = Buffer.from(sealed);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decrypt(tampered));
  process.env.IDENTITY_ENCRYPTION_SECRET =
    "a-different-secret-of-at-least-32-chars!!";
  assert.throws(() => decrypt(sealed));
  process.env.IDENTITY_ENCRYPTION_SECRET =
    "unit-test-secret-of-at-least-32-characters!";
});
test("accepts photos and PDFs only, checked by content", async () => {
  const { documentType } = await import("../src/lib/documents");
  assert.equal(
    documentType(new TextEncoder().encode("%PDF-1.4")),
    "application/pdf",
  );
  assert.equal(
    documentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    "image/jpeg",
  );
  assert.equal(documentType(new TextEncoder().encode("<html><script>")), null);
  assert.equal(documentType(new TextEncoder().encode("<svg onload=x>")), null);
});
test("stores files encrypted and refuses unsafe keys", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "anlima-docs-"));
  process.env.UPLOAD_DIR = dir;
  try {
    const { saveDocumentFile, readDocumentFile, DocumentError } =
      await import("../src/lib/documents");
    const plain = new TextEncoder().encode(
      "%PDF-1.7 Ghana Card GHA-123456789-0",
    );
    const saved = await saveDocumentFile(plain);
    assert.match(
      saved.storageKey,
      /^documents\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.bin$/,
    );
    const onDisk = await readFile(path.join(dir, saved.storageKey));
    assert.ok(
      !onDisk.includes(Buffer.from("GHA-123456789")),
      "nothing readable on disk",
    );
    assert.deepEqual(
      new Uint8Array(await readDocumentFile(saved.storageKey)),
      plain,
    );
    await assert.rejects(readDocumentFile("../../.env"), DocumentError);
    await assert.rejects(
      saveDocumentFile(new TextEncoder().encode("hello")),
      DocumentError,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("summarises licence and Ghana Card status from both sides", async () => {
  const { documentSummary } = await import("../src/lib/documents");
  assert.deepEqual(documentSummary([]), { licence: "MISSING", id: "MISSING" });
  assert.deepEqual(
    documentSummary([
      { kind: "LICENCE_FRONT", status: "APPROVED" },
      { kind: "LICENCE_BACK", status: "APPROVED" },
      { kind: "ID_FRONT", status: "APPROVED" },
    ]),
    { licence: "APPROVED", id: "INCOMPLETE" },
  );
  assert.deepEqual(
    documentSummary([
      { kind: "LICENCE_FRONT", status: "APPROVED" },
      { kind: "LICENCE_BACK", status: "PENDING" },
      { kind: "ID_FRONT", status: "REJECTED" },
      { kind: "ID_BACK", status: "APPROVED" },
    ]),
    { licence: "PENDING", id: "REJECTED" },
  );
});
