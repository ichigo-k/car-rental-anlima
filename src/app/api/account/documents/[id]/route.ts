import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { readDocumentFile, removeDocument } from "@/lib/documents";
// A customer opens or deletes one of their own documents.
async function own(params: Promise<{ id: string }>) {
  const current = await session();
  if (!current) return null;
  const { id } = await params;
  const doc = await db.customerDocument.findUnique({ where: { id } });
  return doc && doc.userId === current.user.id ? doc : null;
}
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const doc = await own(params);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = await readDocumentFile(doc.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const doc = await own(params);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await removeDocument(db, doc);
  return NextResponse.json({ ok: true });
}
