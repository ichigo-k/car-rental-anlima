import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("recognises photos by their content, not their name", async () => {
  const { detectImage } = await import("../src/lib/photos");
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectImage(jpeg)?.contentType, "image/jpeg");
  assert.equal(detectImage(png)?.contentType, "image/png");
  assert.equal(detectImage(webp)?.contentType, "image/webp");
  assert.equal(detectImage(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(detectImage(new TextEncoder().encode("%PDF-1.7")), null);
});
test("stores photos privately and refuses unsafe or oversized files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "anlima-photos-"));
  process.env.UPLOAD_DIR = dir;
  try {
    const { savePhoto, readPhoto, MAX_PHOTO_BYTES, PhotoError } = await import(
      "../src/lib/photos"
    );
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const saved = await savePhoto(jpeg, new Date("2026-11-20T10:00:00Z"));
    assert.match(saved.storageKey, /^2026\/11\/[0-9a-f-]{36}\.jpg$/);
    assert.equal(saved.size, jpeg.length);
    assert.deepEqual(new Uint8Array(await readPhoto(saved.storageKey)), jpeg);
    await assert.rejects(readPhoto("../../.env"), PhotoError);
    await assert.rejects(savePhoto(new Uint8Array()), PhotoError);
    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set([0xff, 0xd8, 0xff]);
    await assert.rejects(savePhoto(huge), PhotoError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
